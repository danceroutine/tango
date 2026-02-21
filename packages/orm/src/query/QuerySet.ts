import type { DBClient } from '../connection/clients/DBClient';
import type { Dialect } from './domain/Dialect';
import type { QuerySetState } from './domain/QuerySetState';
import type { TableMeta } from './domain/TableMeta';
import type { QNode } from './domain/QNode';
import type { QueryResult } from './domain/QueryResult';
import type { OrderToken } from './domain/OrderToken';
import type { FilterInput } from './domain/FilterInput';
import { InternalQNodeType } from './domain/internal/InternalQNodeType';
import { InternalDirection } from './domain/internal/InternalDirection';
import { InternalDialect } from './domain/internal/InternalDialect';
import { QBuilder as Q } from './QBuilder';
import { QueryCompiler } from './compiler';

/**
 * Query execution seam consumed by `QuerySet`.
 *
 * Application code usually reaches this through `Model.objects` or testing
 * fixtures rather than implementing it directly.
 *
 * @template T - The model type
 */
export interface QueryExecutor<T> {
    meta: TableMeta;
    client: DBClient;
    dialect: Dialect;
    run(compiled: { sql: string; params: readonly unknown[] }): Promise<T[]>;
}

/**
 * Django-inspired query builder for constructing and executing database queries.
 * Provides a fluent API for filtering, ordering, pagination, and eager loading.
 *
 * @template T - The model type being queried
 *
 * @example
 * ```typescript
 * const users = await TodoModel.objects
 *   .query()
 *   .filter({ active: true })
 *   .filter(Q.or({ role: 'admin' }, { role: 'moderator' }))
 *   .orderBy('-createdAt')
 *   .limit(10)
 *   .fetch();
 * ```
 */
export class QuerySet<T extends Record<string, unknown>> {
    static readonly BRAND = 'tango.orm.query_set' as const;
    readonly __tangoBrand: typeof QuerySet.BRAND = QuerySet.BRAND;

    constructor(
        private executor: QueryExecutor<T>,
        private state: QuerySetState<T> = {}
    ) {}

    /**
     * Narrow an unknown value to `QuerySet`.
     */
    static isQuerySet<T extends Record<string, unknown>>(value: unknown): value is QuerySet<T> {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === QuerySet.BRAND
        );
    }

    /**
     * Add a filter expression to the query.
     *
     * Multiple `filter()` calls are composed with `AND`.
     */
    filter(q: FilterInput<T> | QNode<T>): QuerySet<T> {
        const wrapped: QNode<T> = (q as QNode<T>).kind
            ? (q as QNode<T>)
            : { kind: InternalQNodeType.ATOM, where: q as FilterInput<T> };
        const merged = this.state.q ? Q.and(this.state.q, wrapped) : wrapped;
        return new QuerySet(this.executor, { ...this.state, q: merged });
    }

    /**
     * Add an exclusion expression to the query.
     *
     * Exclusions are translated to `NOT (...)` predicates.
     */
    exclude(q: FilterInput<T> | QNode<T>): QuerySet<T> {
        const wrapped: QNode<T> = (q as QNode<T>).kind
            ? (q as QNode<T>)
            : { kind: InternalQNodeType.ATOM, where: q as FilterInput<T> };
        const excludes = [...(this.state.excludes ?? []), wrapped];
        return new QuerySet(this.executor, { ...this.state, excludes });
    }

    /**
     * Apply ordering tokens such as `'name'` or `'-createdAt'`.
     */
    orderBy(...tokens: OrderToken<T>[]): QuerySet<T> {
        const order = tokens.map((t) => {
            const str = String(t);
            if (str.startsWith('-')) {
                return { by: str.slice(1) as keyof T, dir: InternalDirection.DESC };
            }
            return { by: t as keyof T, dir: InternalDirection.ASC };
        });
        return new QuerySet(this.executor, { ...this.state, order });
    }

    /**
     * Limit the maximum number of rows returned.
     */
    limit(n: number): QuerySet<T> {
        return new QuerySet(this.executor, { ...this.state, limit: n });
    }

    /**
     * Skip the first `n` rows.
     */
    offset(n: number): QuerySet<T> {
        return new QuerySet(this.executor, { ...this.state, offset: n });
    }

    /**
     * Restrict selected columns.
     */
    select(cols: (keyof T)[]): QuerySet<T> {
        return new QuerySet(this.executor, { ...this.state, select: cols });
    }

    /**
     * Request SQL joins for related data when supported by relation metadata.
     */
    selectRelated(...rels: string[]): QuerySet<T> {
        return new QuerySet(this.executor, { ...this.state, selectRelated: rels });
    }

    /**
     * Register relation names for prefetch behavior.
     *
     * Prefetch orchestration is adapter-specific.
     */
    prefetchRelated(...rels: string[]): QuerySet<T> {
        return new QuerySet(this.executor, { ...this.state, prefetchRelated: rels });
    }

    /**
     * Execute the query and optionally shape each row.
     */
    async fetch<Out = T>(shape?: ((r: T) => Out) | { parse: (r: T) => Out }): Promise<QueryResult<Out>> {
        const compiler = new QueryCompiler(this.executor.meta, this.executor.dialect);
        const compiled = compiler.compile(this.state);
        const rows = await this.executor.run(compiled);
        const normalizedRows = this.normalizeRowsForSchemaParsing(rows, shape);

        const results: Out[] = !shape
            ? (normalizedRows as unknown as Out[])
            : typeof shape === 'function'
              ? normalizedRows.map(shape)
              : normalizedRows.map((r) => shape.parse(r));

        return {
            results,
            nextCursor: null,
        };
    }

    /**
     * Execute the query and return the first row, or `null`.
     */
    async fetchOne<Out = T>(shape?: ((r: T) => Out) | { parse: (r: T) => Out }): Promise<Out | null> {
        const limited = this.limit(1);
        const result = await limited.fetch(shape);
        return result.results[0] ?? null;
    }

    /**
     * Execute a `COUNT(*)` query for the current filtered state.
     */
    async count(): Promise<number> {
        const compiler = new QueryCompiler(this.executor.meta, this.executor.dialect);
        const compiled = compiler.compile(this.state);
        const countQuery = `SELECT COUNT(*) as count FROM (${compiled.sql}) AS tango_count_subquery`;
        const rows = await this.executor.client.query<{ count: number }>(countQuery, compiled.params);
        return Number(rows.rows[0]?.count ?? 0);
    }

    /**
     * Return whether at least one row matches the current query state.
     */
    async exists(): Promise<boolean> {
        const count = await this.count();
        return count > 0;
    }

    private normalizeRowsForSchemaParsing<Out>(rows: T[], shape?: ((r: T) => Out) | { parse: (r: T) => Out }): T[] {
        if (!shape || typeof shape === 'function' || this.executor.dialect !== InternalDialect.SQLITE) {
            return rows;
        }

        const booleanColumns = Object.entries(this.executor.meta.columns)
            .filter(([, value]) => this.isBooleanColumnType(value))
            .map(([column]) => column);

        if (booleanColumns.length === 0) {
            return rows;
        }

        return rows.map((row) => this.normalizeBooleanColumns(row, booleanColumns));
    }

    private isBooleanColumnType(value: unknown): boolean {
        return typeof value === 'string' && ['bool', 'boolean'].includes(value.trim().toLowerCase());
    }

    private normalizeSqliteBoolean(value: unknown): unknown {
        if (value === 0 || value === '0') {
            return false;
        }
        if (value === 1 || value === '1') {
            return true;
        }
        return value;
    }

    private normalizeBooleanColumns(row: T, columns: readonly string[]): T {
        let normalized: T | null = null;

        for (const column of columns) {
            const current = (row as Record<string, unknown>)[column];
            const next = this.normalizeSqliteBoolean(current);
            if (next === current) {
                continue;
            }
            if (!normalized) {
                normalized = { ...row };
            }
            (normalized as Record<string, unknown>)[column] = next;
        }

        return normalized ?? row;
    }
}
