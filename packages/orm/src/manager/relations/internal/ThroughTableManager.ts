import type { DBClient } from '../../../connection/clients/DBClient';
import type { TableMeta } from '../../../query/domain/index';
import type { Adapter } from '../../../connection/adapters/Adapter';
import { OrmSqlSafetyAdapter } from '../../../validation/OrmSqlSafetyAdapter';
import { InternalSqlValidationPlanKind as SqlPlanKind } from '../../../validation/internal/InternalSqlValidationPlanKind';
import {
    InternalDuplicateInsertPolicy,
    MutationCompiler,
    type DuplicateInsertPolicy,
} from '../../internal/MutationCompiler';

/**
 * Resolved through-table descriptor used by {@link ThroughTableManager}. The
 * descriptor is derived once from a relation edge plus its through-model
 * metadata, then reused for every link insert, delete, and read.
 */
export interface ThroughTableLinkDescriptor {
    /** Physical join-table name validated against SQL identifier safety rules. */
    table: string;
    /** Primary-key column name on the join table. */
    primaryKey: string;
    /** Full column map for the join table, used by the SQL safety adapter. */
    columns: Record<string, string>;
    /** Join-table column that stores the owner-side primary-key value. */
    sourceColumn: string;
    /** Join-table column that stores the target-side primary-key value. */
    targetColumn: string;
}

/**
 * Inputs accepted by {@link ThroughTableManager.fromRelation}.
 */
export interface ThroughTableManagerFromRelationInputs {
    relation: NonNullable<TableMeta['relations']>[string];
    throughModelFields: ReadonlyArray<{ name: string; type: string; primaryKey?: boolean }>;
    client: DBClient;
    mutationCompiler: MutationCompiler;
    adapter: Adapter;
    sqlSafetyAdapter: OrmSqlSafetyAdapter;
}

export interface InsertLinkOptions {
    onDuplicate?: DuplicateInsertPolicy;
}

/**
 * Internal helper that issues the INSERT, DELETE, and SELECT statements for
 * a single many-to-many join table. Centralizes SQL safety validation and
 * compilation so {@link ManyToManyRelatedManager} implementations only deal
 * in primary-key values.
 */
export class ThroughTableManager {
    constructor(
        private readonly client: DBClient,
        private readonly mutationCompiler: MutationCompiler,
        private readonly descriptor: ThroughTableLinkDescriptor,
        private readonly adapter: Adapter,
        private readonly sqlSafetyAdapter: OrmSqlSafetyAdapter = new OrmSqlSafetyAdapter()
    ) {}

    /**
     * Derive a {@link ThroughTableLinkDescriptor} from the through-model
     * metadata exposed by a many-to-many relation edge.
     */
    static buildLinkDescriptor(
        relation: NonNullable<TableMeta['relations']>[string],
        throughModelFields: ReadonlyArray<{ name: string; type: string; primaryKey?: boolean }>
    ): ThroughTableLinkDescriptor {
        if (!relation.throughTable || !relation.throughSourceKey || !relation.throughTargetKey) {
            throw new Error(
                'Cannot derive a through-table descriptor from a relation that is not a persisted many-to-many edge.'
            );
        }

        const primaryKeyField = throughModelFields.find((field) => field.primaryKey);
        if (!primaryKeyField) {
            throw new Error('Through-model metadata is missing a primary-key field.');
        }

        return {
            table: relation.throughTable,
            primaryKey: primaryKeyField.name,
            columns: Object.fromEntries(throughModelFields.map((field) => [field.name, field.type])),
            sourceColumn: relation.throughSourceKey,
            targetColumn: relation.throughTargetKey,
        };
    }

    /**
     * Convenience factory that derives the join-table descriptor from the
     * relation edge and instantiates a {@link ThroughTableManager} in one
     * step.
     */
    static fromRelation(inputs: ThroughTableManagerFromRelationInputs): ThroughTableManager {
        return new ThroughTableManager(
            inputs.client,
            inputs.mutationCompiler,
            ThroughTableManager.buildLinkDescriptor(inputs.relation, inputs.throughModelFields),
            inputs.adapter,
            inputs.sqlSafetyAdapter
        );
    }

    /**
     * Read every target primary-key value linked to the supplied owner via
     * the join table. Used by ManyToManyRelatedManager.all to scope
     * follow-up target queries to the current owner.
     */
    async selectTargetIdsForOwner(ownerPrimaryKey: unknown): Promise<readonly (string | number)[]> {
        const validated = this.sqlSafetyAdapter.validate({
            kind: SqlPlanKind.SELECT,
            meta: {
                table: this.descriptor.table,
                pk: this.descriptor.primaryKey,
                columns: this.descriptor.columns,
            },
            filterKeys: [this.descriptor.sourceColumn, this.descriptor.targetColumn],
        });
        const sourceColumn = validated.filterKeys[this.descriptor.sourceColumn]!.field;
        const targetColumn = validated.filterKeys[this.descriptor.targetColumn]!.field;
        const placeholder = this.adapter.placeholders.at(1);
        const sql = `SELECT ${targetColumn} AS target_id FROM ${validated.meta.table} WHERE ${sourceColumn} = ${placeholder}`;
        const result = await this.client.query<{ target_id: string | number }>(sql, [ownerPrimaryKey]);
        return result.rows
            .map((row) => row.target_id)
            .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number');
    }

    async insertLink(
        ownerPrimaryKey: unknown,
        targetPrimaryKey: unknown,
        options: InsertLinkOptions = {}
    ): Promise<void> {
        await this.insertLinks(ownerPrimaryKey, [targetPrimaryKey], options);
    }

    async insertLinks(
        ownerPrimaryKey: unknown,
        targetPrimaryKeys: readonly unknown[],
        options: InsertLinkOptions = {}
    ): Promise<void> {
        if (targetPrimaryKeys.length === 0) {
            return;
        }
        const validatedPlan = this.sqlSafetyAdapter.validate({
            kind: SqlPlanKind.INSERT,
            meta: {
                table: this.descriptor.table,
                pk: this.descriptor.primaryKey,
                columns: this.descriptor.columns,
            },
            writeKeys: [this.descriptor.sourceColumn, this.descriptor.targetColumn],
        });
        const duplicatePolicy = options.onDuplicate ?? InternalDuplicateInsertPolicy.ERROR;
        if (duplicatePolicy === InternalDuplicateInsertPolicy.IGNORE && !this.adapter.features.ignoreDuplicateInsert) {
            throw new Error(
                `Adapter '${this.adapter.name}' does not support duplicate-safe link insertion for many-to-many writes.`
            );
        }
        const compiled = this.mutationCompiler.compileInsertJoinLinks(
            validatedPlan,
            this.descriptor.sourceColumn,
            this.descriptor.targetColumn,
            ownerPrimaryKey,
            targetPrimaryKeys,
            duplicatePolicy
        );
        await this.client.query(compiled.sql, compiled.params);
    }

    async deleteLink(ownerPrimaryKey: unknown, targetPrimaryKey: unknown): Promise<void> {
        await this.deleteLinks(ownerPrimaryKey, [targetPrimaryKey]);
    }

    async deleteLinks(ownerPrimaryKey: unknown, targetPrimaryKeys: readonly unknown[]): Promise<void> {
        if (targetPrimaryKeys.length === 0) {
            return;
        }
        const validated = this.sqlSafetyAdapter.validate({
            kind: SqlPlanKind.SELECT,
            meta: {
                table: this.descriptor.table,
                pk: this.descriptor.primaryKey,
                columns: this.descriptor.columns,
            },
            filterKeys: [this.descriptor.sourceColumn, this.descriptor.targetColumn],
        });
        const compiled = this.mutationCompiler.compileDeleteJoinLinks(
            validated,
            this.descriptor.sourceColumn,
            this.descriptor.targetColumn,
            ownerPrimaryKey,
            targetPrimaryKeys
        );
        await this.client.query(compiled.sql, compiled.params);
    }
}
