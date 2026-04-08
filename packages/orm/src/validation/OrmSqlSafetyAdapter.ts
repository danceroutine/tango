import { SqlSafetyEngine, type SqlIdentifierRequest } from '@danceroutine/tango-core';
import type { LookupType } from '../query/domain/LookupType';
import type { TableMeta } from '../query/domain/TableMeta';
import { InternalLookupType } from '../query/domain/internal/InternalLookupType';
import type {
    SQLValidationEngine,
    ValidatedDeleteSqlPlan,
    ValidatedFilterDescriptor,
    ValidatedInsertSqlPlan,
    ValidatedRelationMeta,
    ValidatedTableMeta,
    ValidatedSelectSqlPlan,
    ValidatedSqlPlan,
    ValidatedUpdateSqlPlan,
} from './SQLValidationEngine';
import type {
    DeleteSqlValidationPlan,
    InsertSqlValidationPlan,
    SelectSqlValidationPlan,
    SqlValidationPlan,
    UpdateSqlValidationPlan,
} from './SqlValidationPlan';

const ALLOWED_LOOKUPS = Object.values(InternalLookupType) as readonly string[];

/**
 * ORM-local adapter that translates query validation plans into the
 * shared Tango SQL safety engine.
 */
export class OrmSqlSafetyAdapter implements SQLValidationEngine {
    static readonly BRAND = 'tango.orm.orm_sql_safety_adapter' as const;
    readonly __tangoBrand: typeof OrmSqlSafetyAdapter.BRAND = OrmSqlSafetyAdapter.BRAND;

    constructor(private readonly engine: SqlSafetyEngine = new SqlSafetyEngine()) {}

    validate(plan: SelectSqlValidationPlan): ValidatedSelectSqlPlan;
    validate(plan: InsertSqlValidationPlan): ValidatedInsertSqlPlan;
    validate(plan: UpdateSqlValidationPlan): ValidatedUpdateSqlPlan;
    validate(plan: DeleteSqlValidationPlan): ValidatedDeleteSqlPlan;
    validate(plan: SqlValidationPlan): ValidatedSqlPlan {
        switch (plan.kind) {
            case 'select': {
                const meta = this.validateTableMeta(plan.meta, plan.relationNames ?? []);
                return {
                    kind: 'select',
                    meta,
                    selectFields: Object.fromEntries(
                        (plan.selectFields ?? []).map((field) => [
                            field,
                            `${meta.table}.${this.resolveColumn(meta, field)}`,
                        ])
                    ),
                    filterKeys: Object.fromEntries(
                        (plan.filterKeys ?? []).map((rawKey) => [rawKey, this.validateFilterKey(meta, rawKey)])
                    ),
                    orderFields: Object.fromEntries(
                        (plan.orderFields ?? []).map((field) => [
                            field,
                            `${meta.table}.${this.resolveColumn(meta, field)}`,
                        ])
                    ),
                    relations: Object.fromEntries(
                        (plan.relationNames ?? []).map((relationName) => [
                            relationName,
                            this.resolveRelation(meta, relationName),
                        ])
                    ),
                };
            }
            case 'insert': {
                const meta = this.validateTableMeta(plan.meta);
                return {
                    kind: 'insert',
                    meta,
                    writeKeys: plan.writeKeys.map((key) => this.resolveColumn(meta, key)),
                };
            }
            case 'update': {
                const meta = this.validateTableMeta(plan.meta);
                return {
                    kind: 'update',
                    meta,
                    writeKeys: plan.writeKeys.map((key) => this.resolveColumn(meta, key)),
                };
            }
            case 'delete': {
                return {
                    kind: 'delete',
                    meta: this.validateTableMeta(plan.meta),
                };
            }
        }
    }

    private validateTableMeta(meta: TableMeta, relationNames: readonly string[] = []): ValidatedTableMeta {
        const columnNames = Object.keys(meta.columns);
        const validated = this.engine.validate({
            identifiers: [
                { key: 'table', role: 'table', value: meta.table },
                { key: 'pk', role: 'primaryKey', value: meta.pk, allowlist: columnNames },
                ...columnNames.map<SqlIdentifierRequest>((column) => ({
                    key: `column:${column}`,
                    role: 'column',
                    value: column,
                })),
            ],
        });

        const validatedMeta: ValidatedTableMeta = {
            table: validated.identifiers.table!.value,
            pk: validated.identifiers.pk!.value,
            columns: Object.fromEntries(
                columnNames.map((column) => [validated.identifiers[`column:${column}`]!.value, meta.columns[column]!])
            ),
        };

        if (!(validatedMeta.pk in validatedMeta.columns)) {
            throw new Error(`Unknown column '${validatedMeta.pk}' for table '${validatedMeta.table}'.`);
        }

        if (relationNames.length > 0) {
            validatedMeta.relations = Object.fromEntries(
                relationNames.map((relationName) => [
                    relationName,
                    this.validateRelationMeta(validatedMeta, relationName, meta.relations),
                ])
            );
        }

        return validatedMeta;
    }

    private validateRelationMeta(
        meta: ValidatedTableMeta,
        relationName: string,
        relations: TableMeta['relations']
    ): ValidatedRelationMeta {
        const relation = relations?.[relationName];
        if (!relation) {
            throw new Error(`Unknown relation '${relationName}' for table '${meta.table}'.`);
        }
        if (!(relation.targetKey in relation.targetColumns)) {
            throw new Error(`Unknown relation target key '${relation.targetKey}' for relation '${relationName}'.`);
        }

        const validated = this.engine.validate({
            identifiers: [
                { key: 'table', role: 'relationTable', value: relation.table },
                { key: 'alias', role: 'alias', value: relation.alias },
                { key: 'targetKey', role: 'relationTargetPrimaryKey', value: relation.targetKey },
                ...Object.keys(relation.targetColumns).map<SqlIdentifierRequest>((column) => ({
                    key: `targetColumn:${column}`,
                    role: 'column',
                    value: column,
                })),
            ],
        });

        return {
            ...relation,
            table: validated.identifiers.table!.value,
            alias: validated.identifiers.alias!.value,
            sourceKey: this.resolveColumn(meta, relation.sourceKey),
            targetKey: validated.identifiers.targetKey!.value,
            targetColumns: Object.fromEntries(
                Object.keys(relation.targetColumns).map((column) => [
                    validated.identifiers[`targetColumn:${column}`]!.value,
                    relation.targetColumns[column]!,
                ])
            ),
        };
    }

    private validateFilterKey(meta: ValidatedTableMeta, rawKey: string): ValidatedFilterDescriptor {
        const segments = rawKey.split('__');
        if (segments.length > 2) {
            throw new Error(`Invalid SQL lookup key: '${rawKey}'.`);
        }

        const field = segments[0]!;
        const lookup = (segments[1] ?? InternalLookupType.EXACT) as LookupType;
        const validated = this.engine.validate({
            lookupTokens: [{ key: rawKey, lookup, allowed: ALLOWED_LOOKUPS }],
        });

        return {
            rawKey,
            field,
            lookup: validated.lookupTokens[rawKey]!.lookup as LookupType,
            qualifiedColumn: `${meta.table}.${this.resolveColumn(meta, field)}`,
        };
    }

    private resolveColumn(meta: ValidatedTableMeta, field: string): string {
        if (!(field in meta.columns)) {
            throw new Error(`Unknown column '${field}' for table '${meta.table}'.`);
        }

        return field;
    }

    private resolveRelation(meta: ValidatedTableMeta, relationName: string): ValidatedRelationMeta {
        const relation = meta.relations?.[relationName];
        if (!relation) {
            throw new Error(`Unknown relation '${relationName}' for table '${meta.table}'.`);
        }

        return relation;
    }
}
