import type { LookupType } from '../domain/LookupType';
import type { QuerySetState } from '../domain/QuerySetState';
import type { TableMeta } from '../domain/TableMeta';
import type { QNode } from '../domain/QNode';
import type { CompiledQuery } from '../domain/CompiledQuery';
import type { WhereClause } from '../domain/WhereClause';
import type { FilterInput } from '../domain/FilterInput';
import type { Dialect } from '../domain/Dialect';
import { InternalDialect } from '../domain/internal/InternalDialect';
import { InternalQNodeType } from '../domain/internal/InternalQNodeType';
import { InternalLookupType } from '../domain/internal/InternalLookupType';
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
        const knownRelationNames = (state.selectRelated ?? []).filter(
            (relationName) => this.meta.relations?.[relationName] !== undefined
        );
        const validatedPlan = sqlSafetyAdapter.validate({
            kind: 'select',
            meta: this.meta,
            selectFields: state.select?.map(String),
            filterKeys: this.collectStateFilterKeys(state),
            orderFields: state.order?.map((order) => String(order.by)),
            relationNames: knownRelationNames,
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

        const select = state.select?.length
            ? state.select.map((field) => validatedPlan.selectFields[String(field)]!).join(', ')
            : `${table}.*`;

        const joins = knownRelationNames
            .map((rel) => {
                const relation = validatedPlan.relations[rel];
                if (!relation || relation.kind !== 'belongsTo') {
                    return '';
                }
                return `LEFT JOIN ${relation.table} ${relation.alias} ON ${relation.alias}.${relation.targetPk} = ${table}.${relation.localKey!}`;
            })
            .filter(Boolean)
            .join(' ');

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

        return { sql, params };
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
