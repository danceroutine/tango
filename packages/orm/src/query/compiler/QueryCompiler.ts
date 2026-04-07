import type { LookupType } from '../domain/LookupType';
import type { QuerySetState } from '../domain/QuerySetState';
import type { TableMeta } from '../domain/TableMeta';
import type { QNode } from '../domain/QNode';
import type { CompiledPrefetchHydration, CompiledPrefetchQuery, CompiledQuery } from '../domain/CompiledQuery';
import type { WhereClause } from '../domain/WhereClause';
import type { FilterInput } from '../domain/FilterInput';
import type { Dialect } from '../domain/Dialect';
import { InternalDialect } from '../domain/internal/InternalDialect';
import { InternalQNodeType } from '../domain/internal/InternalQNodeType';
import { InternalLookupType } from '../domain/internal/InternalLookupType';
import { InternalRelationKind } from '../domain/internal/InternalRelationKind';
import { OrmSqlSafetyAdapter } from '../../validation';

// The adapter is stateless, so a shared module instance keeps compiler construction cheap.
const sqlSafetyAdapter = new OrmSqlSafetyAdapter();

/**
 * Compiles immutable `QuerySet` state into parameterized SQL.
 *
 * The compiler is intentionally stateless with respect to execution and only
 * produces SQL + params artifacts that can be executed by a `DBClient`.
 */
export class QueryCompiler {
    static readonly BRAND = 'tango.orm.query_compiler' as const;
    readonly __tangoBrand: typeof QueryCompiler.BRAND = QueryCompiler.BRAND;

    /**
     * Build a compiler for the given repository metadata and SQL dialect.
     */
    constructor(
        private meta: TableMeta,
        private dialect: Dialect = InternalDialect.POSTGRES
    ) {}

    /**
     * Narrow an unknown value to `QueryCompiler`.
     */
    static isQueryCompiler(value: unknown): value is QueryCompiler {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === QueryCompiler.BRAND
        );
    }

    /**
     * Compile a query state tree into a SQL statement and bound parameters.
     */
    compile<T>(state: QuerySetState<T>): CompiledQuery {
        const selectRelationNames = state.selectRelated ?? [];
        const prefetchRelationNames = state.prefetchRelated ?? [];
        const relationNames = [...new Set([...selectRelationNames, ...prefetchRelationNames])];
        const validatedPlan = sqlSafetyAdapter.validate({
            kind: 'select',
            meta: this.meta,
            selectFields: state.select?.map(String),
            filterKeys: this.collectStateFilterKeys(state),
            orderFields: state.order?.map((order) => String(order.by)),
            relationNames,
        });
        const table = validatedPlan.meta.table;
        const whereParts: string[] = [];
        const params: unknown[] = [];

        if (state.q) {
            const result = this.compileQNode(state.q, params.length + 1, validatedPlan.filterKeys);
            if (result.sql) {
                whereParts.push(result.sql);
                params.push(...result.params);
            }
        }

        state.excludes?.forEach((exclude) => {
            const result = this.compileQNode(
                { kind: InternalQNodeType.NOT, node: exclude },
                params.length + 1,
                validatedPlan.filterKeys
            );
            if (result.sql) {
                whereParts.push(result.sql);
                params.push(...result.params);
            }
        });

        const baseSelect = state.select?.length
            ? state.select.map((field) => validatedPlan.selectFields[String(field)]!).join(', ')
            : `${table}.*`;
        const relationSelects = selectRelationNames.flatMap((relationName) => {
            const relation = validatedPlan.relations[relationName]!;
            return Object.keys(relation.targetColumns).map(
                (column) => `${relation.alias}.${column} AS ${this.buildHydrationColumnAlias(relation.alias, column)}`
            );
        });
        const prefetchSourceSelects =
            state.select?.length && prefetchRelationNames.length
                ? prefetchRelationNames
                      .map((relationName) => validatedPlan.relations[relationName]!)
                      .filter((relation) => !state.select!.map(String).includes(relation.sourceKey))
                      .map(
                          (relation) =>
                              `${table}.${relation.sourceKey} AS ${this.buildPrefetchSourceAlias(relation.sourceKey)}`
                      )
                : [];
        const select = [baseSelect, ...relationSelects, ...prefetchSourceSelects].join(', ');

        const joins = selectRelationNames
            .map((rel) => {
                const relation = validatedPlan.relations[rel]!;
                if (
                    relation.kind !== InternalRelationKind.BELONGS_TO &&
                    relation.kind !== InternalRelationKind.HAS_ONE
                ) {
                    throw new Error(`Relation '${rel}' cannot be loaded with selectRelated(...).`);
                }
                return `LEFT JOIN ${relation.table} ${relation.alias} ON ${relation.alias}.${relation.targetKey} = ${table}.${relation.sourceKey}`;
            })
            .filter(Boolean)
            .join(' ');

        for (const rel of prefetchRelationNames) {
            const relation = validatedPlan.relations[rel];
            if (relation?.kind !== InternalRelationKind.HAS_MANY) {
                throw new Error(`Relation '${rel}' cannot be loaded with prefetchRelated(...).`);
            }
        }

        const whereSQL = whereParts.length ? ` WHERE ${whereParts.join(' AND ')}` : '';
        const orderSQL = ` ORDER BY ${
            state.order?.length
                ? state.order
                      .map((order) => `${validatedPlan.orderFields[String(order.by)]!} ${order.dir.toUpperCase()}`)
                      .join(', ')
                : `${table}.${validatedPlan.meta.pk} ASC`
        }`;
        const limitSQL = state.limit ? ` LIMIT ${state.limit}` : '';
        const offsetSQL = state.offset ? ` OFFSET ${state.offset}` : '';
        const sql = `SELECT ${select} FROM ${table}${joins ? ` ${joins}` : ''}${whereSQL}${orderSQL}${limitSQL}${offsetSQL}`;

        return {
            sql,
            params,
            hydrations: selectRelationNames.map((relationName) => {
                const relation = validatedPlan.relations[relationName]!;
                return {
                    relationName,
                    alias: relation.alias,
                    columns: Object.fromEntries(
                        Object.keys(relation.targetColumns).map((column) => [
                            column,
                            this.buildHydrationColumnAlias(relation.alias, column),
                        ])
                    ),
                };
            }),
            prefetches: prefetchRelationNames.map((relationName) => {
                const relation = validatedPlan.relations[relationName]!;
                const needsAlias = !!state.select?.length && !state.select.map(String).includes(relation.sourceKey);
                return {
                    relationName,
                    sourceKey: relation.sourceKey,
                    sourceKeyAlias: needsAlias ? this.buildPrefetchSourceAlias(relation.sourceKey) : undefined,
                    table: relation.table,
                    targetKey: relation.targetKey,
                    targetColumns: relation.targetColumns,
                };
            }),
        };
    }

    /**
     * Compile the follow-up query used by `prefetchRelated(...)`.
     *
     * The base query cannot bind source values until after it has returned rows,
     * but SQL rendering and validation still belong to the compiler.
     */
    compilePrefetch(
        prefetch: CompiledPrefetchHydration,
        sourceValues: readonly (string | number)[]
    ): CompiledPrefetchQuery {
        const validatedPlan = sqlSafetyAdapter.validate({
            kind: 'select',
            meta: this.meta,
            relationNames: [prefetch.relationName],
        });
        const relation = validatedPlan.relations[prefetch.relationName]!;

        const compiledTargetColumns = Object.keys(prefetch.targetColumns).sort();
        const validatedTargetColumns = Object.keys(relation.targetColumns).sort();
        const compiledMatchesValidated =
            prefetch.sourceKey === relation.sourceKey &&
            prefetch.table === relation.table &&
            prefetch.targetKey === relation.targetKey &&
            compiledTargetColumns.length === validatedTargetColumns.length &&
            compiledTargetColumns.every(
                (column, index) =>
                    column === validatedTargetColumns[index] &&
                    prefetch.targetColumns[column] === relation.targetColumns[column]
            );
        if (!compiledMatchesValidated) {
            throw new Error(`Compiled prefetch metadata for relation '${prefetch.relationName}' failed validation.`);
        }

        const columns = Object.keys(relation.targetColumns);
        const placeholders =
            this.dialect === InternalDialect.POSTGRES
                ? sourceValues.map((_, index) => `$${index + 1}`).join(', ')
                : sourceValues.map(() => '?').join(', ');

        return {
            sql: `SELECT ${columns.join(', ')} FROM ${relation.table} WHERE ${relation.targetKey} IN (${placeholders}) ORDER BY ${relation.targetKey} ASC`,
            params: sourceValues,
            targetKey: relation.targetKey,
            targetColumns: relation.targetColumns,
        };
    }

    private buildHydrationColumnAlias(alias: string, column: string): string {
        return this.assertInternalAliasDoesNotCollide(`__tango_hydrate_${alias}_${column}`);
    }

    private buildPrefetchSourceAlias(sourceKey: string): string {
        return this.assertInternalAliasDoesNotCollide(`__tango_prefetch_${sourceKey}`);
    }

    private assertInternalAliasDoesNotCollide(alias: string): string {
        if (alias in this.meta.columns) {
            throw new Error(`Internal query alias '${alias}' collides with a field on table '${this.meta.table}'.`);
        }
        return alias;
    }

    private compileQNode<T>(
        node: QNode<T>,
        paramIndex: number,
        filterKeys: Record<string, { lookup: LookupType; qualifiedColumn: string }>
    ): WhereClause {
        switch (node.kind) {
            case InternalQNodeType.ATOM:
                return this.compileAtom(node.where || {}, paramIndex, filterKeys);
            case InternalQNodeType.AND:
                return this.compileAnd(node.nodes || [], paramIndex, filterKeys);
            case InternalQNodeType.OR:
                return this.compileOr(node.nodes || [], paramIndex, filterKeys);
            case InternalQNodeType.NOT:
                return this.compileNot(node.node!, paramIndex, filterKeys);
            default:
                return { sql: '', params: [] };
        }
    }

    private compileAtom<T>(
        where: FilterInput<T>,
        paramIndex: number,
        filterKeys: Record<string, { lookup: LookupType; qualifiedColumn: string }>
    ): WhereClause {
        const entries = Object.entries(where).filter(([, value]) => value !== undefined);

        const { parts, params } = entries.reduce<{ parts: string[]; params: unknown[] }>(
            (accumulator, [key, value]) => {
                const descriptor = filterKeys[String(key)]!;
                const idx = paramIndex + accumulator.params.length;
                const clause = this.lookupToSQL(descriptor.qualifiedColumn, descriptor.lookup, value, idx);
                accumulator.parts.push(clause.sql);
                accumulator.params.push(...clause.params);
                return accumulator;
            },
            { parts: [], params: [] }
        );

        return {
            sql: parts.length ? `(${parts.join(' AND ')})` : '',
            params,
        };
    }

    private compileAnd<T>(
        nodes: QNode<T>[],
        paramIndex: number,
        filterKeys: Record<string, { lookup: LookupType; qualifiedColumn: string }>
    ): WhereClause {
        const { parts, params } = nodes.reduce<{ parts: string[]; params: unknown[] }>(
            (accumulator, node) => {
                const result = this.compileQNode(node, paramIndex + accumulator.params.length, filterKeys);
                if (result.sql) {
                    accumulator.parts.push(result.sql);
                    accumulator.params.push(...result.params);
                }
                return accumulator;
            },
            { parts: [], params: [] }
        );

        return {
            sql: parts.length ? `(${parts.join(' AND ')})` : '',
            params,
        };
    }

    private compileOr<T>(
        nodes: QNode<T>[],
        paramIndex: number,
        filterKeys: Record<string, { lookup: LookupType; qualifiedColumn: string }>
    ): WhereClause {
        const { parts, params } = nodes.reduce<{ parts: string[]; params: unknown[] }>(
            (accumulator, node) => {
                const result = this.compileQNode(node, paramIndex + accumulator.params.length, filterKeys);
                if (result.sql) {
                    accumulator.parts.push(result.sql);
                    accumulator.params.push(...result.params);
                }
                return accumulator;
            },
            { parts: [], params: [] }
        );

        return {
            sql: parts.length ? `(${parts.join(' OR ')})` : '',
            params,
        };
    }

    private compileNot<T>(
        node: QNode<T>,
        paramIndex: number,
        filterKeys: Record<string, { lookup: LookupType; qualifiedColumn: string }>
    ): WhereClause {
        const result = this.compileQNode(node, paramIndex, filterKeys);
        if (!result.sql) {
            return { sql: '', params: [] };
        }

        return {
            sql: `(NOT ${result.sql})`,
            params: result.params,
        };
    }

    private lookupToSQL(col: string, lookup: LookupType, value: unknown, paramIndex: number): WhereClause {
        const placeholder = this.dialect === InternalDialect.POSTGRES ? `$${paramIndex}` : '?';
        const normalized = this.normalizeParam(value);

        switch (lookup) {
            case InternalLookupType.EXACT:
                if (value === null) {
                    return { sql: `${col} IS NULL`, params: [] };
                }
                return { sql: `${col} = ${placeholder}`, params: [normalized] };
            case InternalLookupType.LT:
                return { sql: `${col} < ${placeholder}`, params: [normalized] };
            case InternalLookupType.LTE:
                return { sql: `${col} <= ${placeholder}`, params: [normalized] };
            case InternalLookupType.GT:
                return { sql: `${col} > ${placeholder}`, params: [normalized] };
            case InternalLookupType.GTE:
                return { sql: `${col} >= ${placeholder}`, params: [normalized] };
            case InternalLookupType.IN: {
                const entries = (Array.isArray(value) ? value : [value]).map((entry) => this.normalizeParam(entry));
                if (entries.length === 0) {
                    return { sql: '1=0', params: [] };
                }
                const placeholders =
                    this.dialect === InternalDialect.POSTGRES
                        ? entries.map((_, index) => `$${paramIndex + index}`).join(', ')
                        : entries.map(() => '?').join(', ');
                return { sql: `${col} IN (${placeholders})`, params: entries };
            }
            case InternalLookupType.ISNULL:
                return { sql: value ? `${col} IS NULL` : `${col} IS NOT NULL`, params: [] };
            case InternalLookupType.CONTAINS:
                return { sql: `${col} LIKE ${placeholder}`, params: [`%${value}%`] };
            case InternalLookupType.ICONTAINS: {
                const lowerCol = this.dialect === InternalDialect.POSTGRES ? `LOWER(${col})` : `${col}`;
                return { sql: `${lowerCol} LIKE ${placeholder}`, params: [`%${String(value).toLowerCase()}%`] };
            }
            case InternalLookupType.STARTSWITH:
                return { sql: `${col} LIKE ${placeholder}`, params: [`${value}%`] };
            case InternalLookupType.ISTARTSWITH: {
                const lowerCol = this.dialect === InternalDialect.POSTGRES ? `LOWER(${col})` : `${col}`;
                return { sql: `${lowerCol} LIKE ${placeholder}`, params: [`${String(value).toLowerCase()}%`] };
            }
            case InternalLookupType.ENDSWITH:
                return { sql: `${col} LIKE ${placeholder}`, params: [`%${value}`] };
            case InternalLookupType.IENDSWITH: {
                const lowerCol = this.dialect === InternalDialect.POSTGRES ? `LOWER(${col})` : `${col}`;
                return { sql: `${lowerCol} LIKE ${placeholder}`, params: [`%${String(value).toLowerCase()}`] };
            }
            default:
                throw new Error(`Unknown lookup: ${lookup}`);
        }
    }

    private normalizeParam(value: unknown): unknown {
        if (this.dialect === InternalDialect.SQLITE && typeof value === 'boolean') {
            return value ? 1 : 0;
        }
        return value;
    }

    private collectStateFilterKeys<T>(state: QuerySetState<T>): string[] {
        const filterKeys = new Set<string>();
        if (state.q) {
            this.collectNodeFilterKeys(state.q, filterKeys);
        }

        state.excludes?.forEach((exclude) => this.collectNodeFilterKeys(exclude, filterKeys));
        return [...filterKeys];
    }

    private collectNodeFilterKeys<T>(node: QNode<T>, filterKeys: Set<string>): void {
        Object.keys(node.where ?? {}).forEach((key) => filterKeys.add(key));
        node.nodes?.forEach((child) => this.collectNodeFilterKeys(child, filterKeys));
        if (node.node) {
            this.collectNodeFilterKeys(node.node, filterKeys);
        }
    }
}
