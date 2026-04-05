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

type QueryShapeFunction<TInput, TOutput> = (row: TInput) => TOutput;

type QueryShapeParser<TInput, TOutput> = {
    parse: (row: TInput) => TOutput;
};

type QueryShape<TInput> = QueryShapeFunction<TInput, unknown> | QueryShapeParser<TInput, unknown>;

type QueryShapeOutput<TInput, TShape> =
    TShape extends QueryShapeFunction<TInput, infer TOutput>
        ? TOutput
        : TShape extends QueryShapeParser<TInput, infer TOutput>
          ? TOutput
          : never;

type ProjectedResult<
    TModel extends Record<string, unknown>,
    TKeys extends readonly (keyof TModel)[],
> = number extends TKeys['length'] ? TModel : [TKeys[number]] extends [never] ? TModel : Pick<TModel, TKeys[number]>;

/**
 * Django-inspired query builder for constructing and executing database queries.
 * Provides a fluent API for filtering, ordering, pagination, and eager loading.
 *
 * @template TModel - The full model row type used for query composition
 * @template TResult - The fetched row shape returned by execution methods
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
export class QuerySet<TModel extends Record<string, unknown>, TResult extends Record<string, unknown> = TModel> {
    static readonly BRAND = 'tango.orm.query_set' as const;
    readonly __tangoBrand: typeof QuerySet.BRAND = QuerySet.BRAND;

    constructor(
        private executor: QueryExecutor<TModel>,
        private state: QuerySetState<TModel> = {}
    ) {}

    /**
     * Narrow an unknown value to `QuerySet`.
     */
    static isQuerySet<TModel extends Record<string, unknown>, TResult extends Record<string, unknown> = TModel>(
        value: unknown
    ): value is QuerySet<TModel, TResult> {
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
    filter(q: FilterInput<TModel> | QNode<TModel>): QuerySet<TModel, TResult> {
        const wrapped: QNode<TModel> = (q as QNode<TModel>).kind
            ? (q as QNode<TModel>)
            : { kind: InternalQNodeType.ATOM, where: q as FilterInput<TModel> };
        const merged = this.state.q ? Q.and(this.state.q, wrapped) : wrapped;
        return new QuerySet(this.executor, { ...this.state, q: merged });
    }

    /**
     * Add an exclusion expression to the query.
     *
     * Exclusions are translated to `NOT (...)` predicates.
     */
    exclude(q: FilterInput<TModel> | QNode<TModel>): QuerySet<TModel, TResult> {
        const wrapped: QNode<TModel> = (q as QNode<TModel>).kind
            ? (q as QNode<TModel>)
            : { kind: InternalQNodeType.ATOM, where: q as FilterInput<TModel> };
        const excludes = [...(this.state.excludes ?? []), wrapped];
        return new QuerySet(this.executor, { ...this.state, excludes });
    }

    /**
     * Apply ordering tokens such as `'name'` or `'-createdAt'`.
     */
    orderBy(...tokens: OrderToken<TModel>[]): QuerySet<TModel, TResult> {
        const order = tokens.map((t) => {
            const str = String(t);
            if (str.startsWith('-')) {
                return { by: str.slice(1) as keyof TModel, dir: InternalDirection.DESC };
            }
            return { by: t as keyof TModel, dir: InternalDirection.ASC };
        });
        return new QuerySet(this.executor, { ...this.state, order });
    }

    /**
     * Limit the maximum number of rows returned.
     */
    limit(n: number): QuerySet<TModel, TResult> {
        return new QuerySet(this.executor, { ...this.state, limit: n });
    }

    /**
     * Skip the first `n` rows.
     */
    offset(n: number): QuerySet<TModel, TResult> {
        return new QuerySet(this.executor, { ...this.state, offset: n });
    }

    /**
     * Restrict selected columns and narrow the fetched row type when the
     * selected keys are known precisely at the call site.
     *
     * Empty selections reset back to the full model row, and repeated
     * `select(...)` calls replace the previous projection rather than
     * intersecting it.
     */
    select<const TKeys extends readonly (keyof TModel)[]>(
        cols: TKeys
    ): QuerySet<TModel, ProjectedResult<TModel, TKeys>>;
    select(cols: readonly (keyof TModel)[]): QuerySet<TModel, TModel>;
    select(cols: readonly (keyof TModel)[]): QuerySet<TModel, TModel> {
        return new QuerySet(this.executor, { ...this.state, select: [...cols] as (keyof TModel)[] });
    }

    /**
     * Request SQL joins for related data when supported by relation metadata.
     */
    selectRelated(...rels: string[]): QuerySet<TModel, TResult> {
        return new QuerySet(this.executor, { ...this.state, selectRelated: rels });
    }

    /**
     * Register relation names for prefetch behavior.
     *
     * Prefetch orchestration is adapter-specific.
     */
    prefetchRelated(...rels: string[]): QuerySet<TModel, TResult> {
        return new QuerySet(this.executor, { ...this.state, prefetchRelated: rels });
    }

    /**
     * Execute the query and optionally shape each row.
     *
     * When the queryset has been narrowed by `select(...)`, rows passed to the
     * shaping callback or parser use that narrowed fetched-row type.
     */
    async fetch(): Promise<QueryResult<TResult>>;
    async fetch<Out>(shape: QueryShapeFunction<TResult, Out>): Promise<QueryResult<Out>>;
    async fetch<Out>(shape: QueryShapeParser<TResult, Out>): Promise<QueryResult<Out>>;
    async fetch<TShape extends QueryShape<TResult> | undefined>(
        shape: TShape
    ): Promise<QueryResult<TResult | QueryShapeOutput<TResult, NonNullable<TShape>>>>;
    async fetch<Out>(
        shape?: QueryShapeFunction<TResult, Out> | QueryShapeParser<TResult, Out>
    ): Promise<QueryResult<TResult | Out>> {
        const compiler = new QueryCompiler(this.executor.meta, this.executor.dialect);
        const compiled = compiler.compile(this.state);
        const rows = await this.executor.run(compiled);
        const normalizedRows = this.normalizeRowsForSchemaParsing(rows, shape);
        const projectedRows = normalizedRows as unknown as TResult[];

        const results: Array<TResult | Out> = !shape
            ? projectedRows
            : typeof shape === 'function'
              ? projectedRows.map(shape)
              : projectedRows.map((r) => shape.parse(r));

        return {
            results,
            nextCursor: null,
        };
    }

    /**
     * Execute the query and return the first row, or `null`.
     *
     * As with `fetch(...)`, parser and function overloads receive the current
     * fetched-row type after any `select(...)` projection narrowing.
     */
    async fetchOne(): Promise<TResult | null>;
    async fetchOne<Out>(shape: QueryShapeFunction<TResult, Out>): Promise<Out | null>;
    async fetchOne<Out>(shape: QueryShapeParser<TResult, Out>): Promise<Out | null>;
    async fetchOne<TShape extends QueryShape<TResult> | undefined>(
        shape: TShape
    ): Promise<TResult | QueryShapeOutput<TResult, NonNullable<TShape>> | null>;
    async fetchOne<Out>(
        shape?: QueryShapeFunction<TResult, Out> | QueryShapeParser<TResult, Out>
    ): Promise<TResult | Out | null> {
        const limited = this.limit(1);
        const result = !shape
            ? await limited.fetch()
            : typeof shape === 'function'
              ? await limited.fetch(shape)
              : await limited.fetch(shape);
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

    private normalizeRowsForSchemaParsing<Out>(
        rows: TModel[],
        shape?: QueryShapeFunction<TResult, Out> | QueryShapeParser<TResult, Out>
    ): TModel[] {
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

    private normalizeBooleanColumns(row: TModel, columns: readonly string[]): TModel {
        let normalized: TModel | null = null;

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
