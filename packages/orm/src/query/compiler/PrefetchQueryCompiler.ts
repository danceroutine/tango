import { isError } from '@danceroutine/tango-core';
import type { Adapter, SqlPlaceholders } from '../../connection/adapters/Adapter';
import { OrmSqlSafetyAdapter } from '../../validation';
import { InternalSqlValidationPlanKind as SqlPlanKind } from '../../validation/internal/InternalSqlValidationPlanKind';
import type { CompiledHydrationNode, CompiledPrefetchQuery } from '../domain/CompiledQuery';
import { InternalPrefetchQueryKind } from '../domain/internal/InternalPrefetchQueryKind';
import type { TableMeta } from '../domain/TableMeta';

const sqlSafetyAdapter = new OrmSqlSafetyAdapter();

type JoinCollection = {
    selects: string[];
    joins: string[];
};

/**
 * Compiles follow-up SQL for prefetch-backed relation hydration.
 */
export class PrefetchQueryCompiler {
    private readonly placeholders: SqlPlaceholders;

    constructor(
        private readonly meta: TableMeta,
        adapter: Adapter
    ) {
        this.placeholders = adapter.placeholders;
    }

    compilePrefetch(node: CompiledHydrationNode, sourceValues: readonly (string | number)[]): CompiledPrefetchQuery {
        if (node.throughTable && node.throughSourceKey && node.throughTargetKey) {
            return this.compileManyToManyPrefetch(node, sourceValues);
        }

        const placeholders = this.placeholders.list(sourceValues.length);
        const validatedTarget = this.validatePrefetchTarget(node);
        const baseAlias = this.buildPrefetchBaseAlias(node.relationPath);
        const joinCollection: JoinCollection = { selects: [], joins: [] };

        for (const joinChild of node.joinChildren) {
            this.collectNestedJoinSql(joinChild, baseAlias, validatedTarget.columns, joinCollection);
        }

        const baseSelects = Object.keys(validatedTarget.columns).map((column) => `${baseAlias}.${column} AS ${column}`);
        return {
            kind: InternalPrefetchQueryKind.DIRECT,
            sql: `SELECT ${[...baseSelects, ...joinCollection.selects].join(', ')} FROM ${validatedTarget.table} ${baseAlias}${joinCollection.joins.length ? ` ${joinCollection.joins.join(' ')}` : ''} WHERE ${baseAlias}.${validatedTarget.targetKey} IN (${placeholders}) ORDER BY ${baseAlias}.${validatedTarget.targetKey} ASC, ${baseAlias}.${validatedTarget.primaryKey} ASC`,
            params: sourceValues,
            targetKey: validatedTarget.targetKey,
            targetColumns: validatedTarget.columns,
        };
    }

    compileManyToManyTargets(
        node: CompiledHydrationNode,
        targetIds: readonly (string | number)[]
    ): { sql: string; params: readonly unknown[] } {
        const placeholders = this.placeholders.list(targetIds.length);
        const validatedTarget = this.validatePrefetchTarget(node);
        const baseAlias = this.buildPrefetchBaseAlias(node.relationPath);
        const joinCollection: JoinCollection = { selects: [], joins: [] };

        for (const joinChild of node.joinChildren) {
            this.collectNestedJoinSql(joinChild, baseAlias, validatedTarget.columns, joinCollection);
        }

        const baseSelects = Object.keys(validatedTarget.columns).map((column) => `${baseAlias}.${column} AS ${column}`);
        return {
            sql: `SELECT ${[...baseSelects, ...joinCollection.selects].join(', ')} FROM ${validatedTarget.table} ${baseAlias}${joinCollection.joins.length ? ` ${joinCollection.joins.join(' ')}` : ''} WHERE ${baseAlias}.${validatedTarget.primaryKey} IN (${placeholders}) ORDER BY ${baseAlias}.${validatedTarget.primaryKey} ASC`,
            params: targetIds,
        };
    }

    private compileManyToManyPrefetch(
        node: CompiledHydrationNode,
        sourceValues: readonly (string | number)[]
    ): CompiledPrefetchQuery {
        const placeholders = this.placeholders.list(sourceValues.length);
        const throughValidated = sqlSafetyAdapter.validate({
            kind: SqlPlanKind.SELECT,
            meta: {
                table: node.throughTable!,
                pk: node.throughSourceKey!,
                columns: {
                    [node.throughSourceKey!]: node.throughSourceColumnType ?? 'int',
                    [node.throughTargetKey!]: node.throughTargetColumnType ?? 'int',
                },
            },
            filterKeys: [node.throughSourceKey!, node.throughTargetKey!],
            relationNames: [],
        });
        const ownerAlias = this.validateInternalAlias('__tango_m2m_owner');
        const targetAlias = this.validateInternalAlias('__tango_m2m_target');
        const throughSourceColumn = throughValidated.filterKeys[node.throughSourceKey!]!.field;
        const throughTargetColumn = throughValidated.filterKeys[node.throughTargetKey!]!.field;
        return {
            kind: InternalPrefetchQueryKind.MANY_TO_MANY,
            throughSql: `SELECT ${throughValidated.meta.table}.${throughSourceColumn} AS ${ownerAlias}, ${throughValidated.meta.table}.${throughTargetColumn} AS ${targetAlias} FROM ${throughValidated.meta.table} WHERE ${throughValidated.meta.table}.${throughSourceColumn} IN (${placeholders}) ORDER BY ${throughValidated.meta.table}.${throughSourceColumn} ASC, ${throughValidated.meta.table}.${throughTargetColumn} ASC`,
            throughParams: sourceValues,
            ownerAlias,
            targetAlias,
            targetTable: node.targetTable,
            targetPrimaryKey: node.targetPrimaryKey,
            targetColumns: node.targetColumns,
        };
    }

    private validatePrefetchTarget(node: CompiledHydrationNode): {
        table: string;
        primaryKey: string;
        targetKey: string;
        columns: Record<string, string>;
    } {
        try {
            const validated = sqlSafetyAdapter.validate({
                kind: SqlPlanKind.SELECT,
                meta: {
                    table: node.targetTable,
                    pk: node.targetPrimaryKey,
                    columns: node.targetColumns,
                },
                filterKeys: [node.targetKey],
            });

            return {
                table: validated.meta.table,
                primaryKey: validated.meta.pk,
                targetKey: validated.filterKeys[node.targetKey]!.field,
                columns: validated.meta.columns,
            };
        } catch (error) {
            const message = isError(error) ? error.message : String(error);
            throw new Error(`Compiled prefetch query failed validation: ${message}`, { cause: error });
        }
    }

    private collectNestedJoinSql(
        node: CompiledHydrationNode,
        ownerAlias: string,
        ownerColumns: Record<string, string>,
        collection: JoinCollection
    ): void {
        if (!node.join) {
            return;
        }

        const validatedTarget = this.validatePrefetchJoinTarget(node, ownerColumns);
        const validatedJoinAlias = this.validateInternalAlias(node.join.alias);
        const validatedJoinColumns = Object.fromEntries(
            Object.entries(node.join.columns).map(([column, alias]) => {
                if (!(column in validatedTarget.columns)) {
                    throw new Error(
                        `Compiled prefetch query failed validation: unknown nested join column '${column}'.`
                    );
                }
                return [column, this.validateInternalAlias(alias)];
            })
        );

        collection.joins.push(
            `LEFT JOIN ${validatedTarget.table} ${validatedJoinAlias} ON ${validatedJoinAlias}.${validatedTarget.targetKey} = ${ownerAlias}.${node.sourceKey}`
        );
        collection.selects.push(
            ...Object.entries(validatedJoinColumns).map(
                ([column, alias]) => `${validatedJoinAlias}.${column} AS ${alias}`
            )
        );

        for (const child of node.joinChildren) {
            this.collectNestedJoinSql(child, validatedJoinAlias, validatedTarget.columns, collection);
        }
    }

    private validatePrefetchJoinTarget(
        node: CompiledHydrationNode,
        ownerColumns: Record<string, string>
    ): {
        table: string;
        primaryKey: string;
        targetKey: string;
        columns: Record<string, string>;
    } {
        if (!(node.sourceKey in ownerColumns)) {
            throw new Error(
                `Compiled prefetch query failed validation: unknown owner column '${node.sourceKey}' for nested join.`
            );
        }

        return this.validatePrefetchTarget(node);
    }

    private validateInternalAlias(alias: string): string {
        if (!/^__tango_[A-Za-z0-9_]+$/u.test(alias)) {
            throw new Error(`Compiled prefetch query failed validation: invalid internal alias '${alias}'.`);
        }

        return alias;
    }

    private buildPrefetchBaseAlias(relationPath: string): string {
        return this.assertInternalAliasDoesNotCollide(
            `__tango_prefetch_base_${this.sanitizeRelationPath(relationPath)}`
        );
    }

    private sanitizeRelationPath(relationPath: string): string {
        return relationPath.replace(/[^a-zA-Z0-9]+/gu, '_');
    }

    private assertInternalAliasDoesNotCollide(alias: string): string {
        if (alias in this.meta.columns) {
            throw new Error(`Internal query alias '${alias}' collides with a field on table '${this.meta.table}'.`);
        }
        return alias;
    }
}
