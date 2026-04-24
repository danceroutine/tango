import type { DBClient } from '../connection/clients/DBClient';
import type { Adapter } from '../connection/adapters/Adapter';
import type { QuerySetState } from './domain/QuerySetState';
import type { TableMeta } from './domain/TableMeta';
import type { QNode } from './domain/QNode';
import { NotFoundError, MultipleObjectsReturned } from '@danceroutine/tango-core';
import { QueryResult } from './domain/QueryResult';
import type { OrderToken } from './domain/OrderToken';
import type { OrderSpec } from './domain/OrderSpec';
import type { FilterInput } from './domain/FilterInput';
import type { CompiledQuery } from './domain/CompiledQuery';
import type { CompiledHydrationNode } from './domain/CompiledQuery';
import type {
    GeneratedHydratedRelationMap,
    GeneratedPrefetchRelatedPathKeys,
    GeneratedSelectRelatedPathKeys,
    HydratedQueryResult,
    ManyRelationHydrationCardinality,
    MaybeHydratedRelationMap,
    PrefetchRelatedRelations,
    RelationKeys,
    SelectRelatedRelations,
    SingleRelationHydrationCardinality,
} from './domain/RelationTyping';
import { InternalRelationHydrationCardinality } from './domain/RelationTyping';
import { InternalQNodeType } from './domain/internal/InternalQNodeType';
import { InternalDirection } from './domain/internal/InternalDirection';
import { InternalDialect } from './domain/internal/InternalDialect';
import { InternalPrefetchQueryKind } from './domain/internal/InternalPrefetchQueryKind';
import { QBuilder as Q } from './QBuilder';
import { QueryCompiler } from './compiler';
import { isQNodeLike } from './internal/isQNodeLike';
// TODO revisit this later. QuerySet is getting very heavy between handling query building, prefetching, canonicalization, and hydration, and caching.
/**
 * Query execution seam consumed by `QuerySet`.
 *
 * Application code usually reaches this through `Model.objects` or testing
 * fixtures rather than implementing it directly.
 *
 * @template TModel - The model row type returned by the database client
 */
export interface QueryExecutor<TModel> {
    meta: TableMeta;
    client: DBClient;
    adapter: Adapter;
    run(compiled: CompiledQuery): Promise<TModel[]>;
    // TODO revisit this and determine if we have enough complexity to justify a recordfactory
    /**
     * Optional hook invoked by `QuerySet` after a record has been
     * materialized so executors can attach related-manager accessors
     * (such as the many-to-many related manager) onto the record.
     *
     * The optional `modelKey` argument lets the executor route the attach
     * call to the correct model when the record belongs to a related
     * model rather than the executor's own source model. Implementations
     * must not overwrite existing properties on the record so prior
     * hydration assignments survive the attach pass.
     */
    attachPersistedRecordAccessors?(record: Record<string, unknown>, modelKey?: string): void;
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

type TargetColumnMetadata = {
    targetColumns: Record<string, string>;
};

type ProjectedResult<
    TModel extends Record<string, unknown>,
    TKeys extends readonly (keyof TModel)[],
> = number extends TKeys['length'] ? TModel : [TKeys[number]] extends [never] ? TModel : Pick<TModel, TKeys[number]>;

/**
 * Django-inspired query builder for constructing and executing database queries.
 * Provides a fluent API for filtering, ordering, pagination, projection, and
 * nested relation hydration.
 *
 * @template TModel - The full model row type used for query composition
 * @template TBaseResult - The selected base-row shape returned by execution methods
 * @template TSourceModel - The source Tango model used for typed relation metadata
 * @template THydrated - Relation properties accumulated by eager-loading calls
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
export abstract class QuerySet<
    TModel extends Record<string, unknown>,
    TBaseResult extends Record<string, unknown> = TModel,
    TSourceModel = unknown,
    THydrated extends Record<string, unknown> = Record<never, never>,
> implements AsyncIterable<HydratedQueryResult<TBaseResult, THydrated>>
{
    static readonly BRAND = 'tango.orm.query_set' as const;
    readonly __tangoBrand: typeof QuerySet.BRAND = QuerySet.BRAND;
    private evaluationCache?: Promise<QueryResult<HydratedQueryResult<TBaseResult, THydrated>>>;

    constructor(
        protected executor: QueryExecutor<TModel>,
        protected state: QuerySetState<TModel, TSourceModel> = {}
    ) {}

    /**
     * Create another queryset of the same runtime family with the supplied
     * query state. Concrete subclasses implement this so fluent calls keep
     * their subclass-specific execution behavior instead of falling back to
     * the standard queryset implementation.
     */
    protected abstract spawn<
        TNextBaseResult extends Record<string, unknown> = TBaseResult,
        TNextHydrated extends Record<string, unknown> = THydrated,
    >(state: QuerySetState<TModel, TSourceModel>): QuerySet<TModel, TNextBaseResult, TSourceModel, TNextHydrated>;

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
     * Translate user-facing order tokens like `'name'` or `'-createdAt'` into
     * the internal `OrderSpec` array used by `QuerySetState`.
     *
     * Exposed as `protected` so subclasses can compose the same parse logic
     * when they need to return their own concrete type from `orderBy` without
     * reaching into a base-class instance's protected state.
     */
    protected static buildOrderSpecs<T extends Record<string, unknown>>(
        tokens: readonly OrderToken<T>[]
    ): OrderSpec<T>[] {
        return tokens.map((t) => {
            const str = String(t);
            if (str.startsWith('-')) {
                return { by: str.slice(1) as keyof T, dir: InternalDirection.DESC };
            }
            return { by: t as keyof T, dir: InternalDirection.ASC };
        });
    }

    private static invertOrderSpec<T extends Record<string, unknown>>(
        order: QuerySetState<T>['order']
    ): NonNullable<QuerySetState<T>['order']> {
        if (!order?.length) {
            return [];
        }
        return order.map((spec) => ({
            by: spec.by,
            dir: spec.dir === InternalDirection.ASC ? InternalDirection.DESC : InternalDirection.ASC,
        }));
    }

    /**
     * Add a filter expression to the query.
     *
     * Multiple `filter()` calls are composed with `AND`.
     */
    filter(
        q: FilterInput<TModel, TSourceModel> | QNode<TModel, TSourceModel>
    ): QuerySet<TModel, TBaseResult, TSourceModel, THydrated> {
        const wrapped: QNode<TModel, TSourceModel> = isQNodeLike(q)
            ? q
            : { kind: InternalQNodeType.ATOM, where: q as FilterInput<TModel, TSourceModel> };
        const merged = this.state.q ? Q.and(this.state.q, wrapped) : wrapped;
        return this.spawn({ ...this.state, q: merged });
    }

    /**
     * Add an exclusion expression to the query.
     *
     * Exclusions are translated to `NOT (...)` predicates.
     */
    exclude(
        q: FilterInput<TModel, TSourceModel> | QNode<TModel, TSourceModel>
    ): QuerySet<TModel, TBaseResult, TSourceModel, THydrated> {
        const wrapped: QNode<TModel, TSourceModel> = isQNodeLike(q)
            ? q
            : { kind: InternalQNodeType.ATOM, where: q as FilterInput<TModel, TSourceModel> };
        const excludes = [...(this.state.excludes ?? []), wrapped];
        return this.spawn({ ...this.state, excludes });
    }

    /**
     * Apply ordering tokens such as `'name'` or `'-createdAt'`.
     */
    orderBy(...tokens: OrderToken<TModel>[]): QuerySet<TModel, TBaseResult, TSourceModel, THydrated> {
        return this.spawn({ ...this.state, order: QuerySet.buildOrderSpecs<TModel>(tokens) });
    }

    /**
     * Limit the maximum number of rows returned.
     */
    limit(n: number): QuerySet<TModel, TBaseResult, TSourceModel, THydrated> {
        return this.spawn({ ...this.state, limit: n });
    }

    /**
     * Skip the first `n` rows.
     */
    offset(n: number): QuerySet<TModel, TBaseResult, TSourceModel, THydrated> {
        return this.spawn({ ...this.state, offset: n });
    }

    /**
     * Restrict selected fields and narrow the fetched row type when the
     * selected keys are known precisely at the call site.
     *
     * Empty selections reset back to the full model row, and repeated
     * `select(...)` calls replace the previous projection rather than
     * intersecting it.
     */
    select<const TKeys extends readonly (keyof TModel)[]>(
        fields: TKeys
    ): QuerySet<TModel, ProjectedResult<TModel, TKeys>, TSourceModel, THydrated>;
    select(
        fields: readonly (keyof TModel)[]
    ): QuerySet<TModel, ProjectedResult<TModel, readonly (keyof TModel)[]>, TSourceModel, THydrated>;
    select(
        fields: readonly (keyof TModel)[]
    ): QuerySet<TModel, ProjectedResult<TModel, readonly (keyof TModel)[]>, TSourceModel, THydrated> {
        return this.spawn<ProjectedResult<TModel, readonly (keyof TModel)[]>, THydrated>({
            ...this.state,
            select: [...fields] as (keyof TModel)[],
        });
    }

    /**
     * Hydrate single-valued relation paths through SQL joins.
     *
     * Forward `belongsTo` relations can be inferred from the source model's
     * field-authored relation metadata. Reverse `hasOne` relations can be
     * selected with a target model generic when the target model points back to
     * the source model. Generated relation typing also enables nested `__`
     * path keys for applications that keep the app-local registry current.
     */
    selectRelated<
        TTargetModel = undefined,
        const TRelationName extends
            | RelationKeys<SelectRelatedRelations<TSourceModel, NoInfer<TTargetModel>>>
            | GeneratedSelectRelatedPathKeys<TSourceModel> =
            | RelationKeys<SelectRelatedRelations<TSourceModel, NoInfer<TTargetModel>>>
            | GeneratedSelectRelatedPathKeys<TSourceModel>,
    >(
        ...rels: readonly TRelationName[]
    ): QuerySet<
        TModel,
        TBaseResult,
        TSourceModel,
        THydrated &
            MaybeHydratedRelationMap<
                TSourceModel,
                SelectRelatedRelations<TSourceModel, NoInfer<TTargetModel>>,
                Extract<TRelationName, RelationKeys<SelectRelatedRelations<TSourceModel, NoInfer<TTargetModel>>>>,
                SingleRelationHydrationCardinality
            > &
            GeneratedHydratedRelationMap<
                TSourceModel,
                Extract<TRelationName, GeneratedSelectRelatedPathKeys<TSourceModel>>
            >
    > {
        return this.spawn<
            TBaseResult,
            THydrated &
                MaybeHydratedRelationMap<
                    TSourceModel,
                    SelectRelatedRelations<TSourceModel, NoInfer<TTargetModel>>,
                    Extract<TRelationName, RelationKeys<SelectRelatedRelations<TSourceModel, NoInfer<TTargetModel>>>>,
                    SingleRelationHydrationCardinality
                > &
                GeneratedHydratedRelationMap<
                    TSourceModel,
                    Extract<TRelationName, GeneratedSelectRelatedPathKeys<TSourceModel>>
                >
        >({ ...this.state, selectRelated: [...rels] });
    }

    /**
     * Hydrate collection-rooted relation paths with follow-up queries.
     *
     * Reverse `hasMany` relations can be prefetched with a target model generic
     * when the target model points back to the source model. Generated relation
     * typing also enables nested `__` path keys for applications that keep the
     * app-local registry current.
     */
    prefetchRelated<
        TTargetModel = undefined,
        const TRelationName extends
            | RelationKeys<PrefetchRelatedRelations<TSourceModel, NoInfer<TTargetModel>>>
            | GeneratedPrefetchRelatedPathKeys<TSourceModel> =
            | RelationKeys<PrefetchRelatedRelations<TSourceModel, NoInfer<TTargetModel>>>
            | GeneratedPrefetchRelatedPathKeys<TSourceModel>,
    >(
        ...rels: readonly TRelationName[]
    ): QuerySet<
        TModel,
        TBaseResult,
        TSourceModel,
        THydrated &
            MaybeHydratedRelationMap<
                TSourceModel,
                PrefetchRelatedRelations<TSourceModel, NoInfer<TTargetModel>>,
                Extract<TRelationName, RelationKeys<PrefetchRelatedRelations<TSourceModel, NoInfer<TTargetModel>>>>,
                ManyRelationHydrationCardinality
            > &
            GeneratedHydratedRelationMap<
                TSourceModel,
                Extract<TRelationName, GeneratedPrefetchRelatedPathKeys<TSourceModel>>
            >
    > {
        return this.spawn<
            TBaseResult,
            THydrated &
                MaybeHydratedRelationMap<
                    TSourceModel,
                    PrefetchRelatedRelations<TSourceModel, NoInfer<TTargetModel>>,
                    Extract<TRelationName, RelationKeys<PrefetchRelatedRelations<TSourceModel, NoInfer<TTargetModel>>>>,
                    ManyRelationHydrationCardinality
                > &
                GeneratedHydratedRelationMap<
                    TSourceModel,
                    Extract<TRelationName, GeneratedPrefetchRelatedPathKeys<TSourceModel>>
                >
        >({ ...this.state, prefetchRelated: [...rels] });
    }

    all(): QuerySet<TModel, TBaseResult, TSourceModel, THydrated> {
        return this.spawn({ ...this.state });
    }

    /**
     * Execute the query and optionally shape each row.
     *
     * When the queryset has been narrowed by `select(...)`, rows passed to the
     * shaping callback or parser use that narrowed fetched-row type.
     */
    async fetch(): Promise<QueryResult<HydratedQueryResult<TBaseResult, THydrated>>>;
    async fetch<Out>(
        shape: QueryShapeFunction<HydratedQueryResult<TBaseResult, THydrated>, Out>
    ): Promise<QueryResult<Out>>;
    async fetch<Out>(
        shape: QueryShapeParser<HydratedQueryResult<TBaseResult, THydrated>, Out>
    ): Promise<QueryResult<Out>>;
    async fetch<TShape extends QueryShape<HydratedQueryResult<TBaseResult, THydrated>> | undefined>(
        shape: TShape
    ): Promise<
        QueryResult<
            | HydratedQueryResult<TBaseResult, THydrated>
            | QueryShapeOutput<HydratedQueryResult<TBaseResult, THydrated>, NonNullable<TShape>>
        >
    >;
    async fetch<Out>(
        shape?:
            | QueryShapeFunction<HydratedQueryResult<TBaseResult, THydrated>, Out>
            | QueryShapeParser<HydratedQueryResult<TBaseResult, THydrated>, Out>
    ): Promise<QueryResult<HydratedQueryResult<TBaseResult, THydrated> | Out>> {
        const baseResult = await this.getOrCreateEvaluationCache();
        if (!shape) {
            return baseResult;
        }

        const results: Array<HydratedQueryResult<TBaseResult, THydrated> | Out> =
            typeof shape === 'function'
                ? baseResult.items.map(shape)
                : this.normalizeHydratedRowsForParserShape(baseResult.items).map((row) => shape.parse(row));

        return new QueryResult(results);
    }

    /**
     * Async iterable surface for `for await (... of queryset)`.
     *
     * Evaluates this queryset on first use by awaiting `fetch()` without
     * arguments, then yields each element from that materialized result.
     * Later async iterations over the same queryset instance reuse the cached
     * materialized result instead of issuing another database round-trip.
     */
    async *[Symbol.asyncIterator](): AsyncIterator<HydratedQueryResult<TBaseResult, THydrated>> {
        const result = await this.fetch();
        for (const row of result) {
            yield row;
        }
    }

    /**
     * Execute the query and return the first row, or `null`.
     *
     * As with `fetch(...)`, parser and function overloads receive the current
     * fetched-row type after any `select(...)` projection narrowing.
     */
    async fetchOne(): Promise<HydratedQueryResult<TBaseResult, THydrated> | null>;
    async fetchOne<Out>(
        shape: QueryShapeFunction<HydratedQueryResult<TBaseResult, THydrated>, Out>
    ): Promise<Out | null>;
    async fetchOne<Out>(shape: QueryShapeParser<HydratedQueryResult<TBaseResult, THydrated>, Out>): Promise<Out | null>;
    async fetchOne<TShape extends QueryShape<HydratedQueryResult<TBaseResult, THydrated>> | undefined>(
        shape: TShape
    ): Promise<
        | HydratedQueryResult<TBaseResult, THydrated>
        | QueryShapeOutput<HydratedQueryResult<TBaseResult, THydrated>, NonNullable<TShape>>
        | null
    >;
    async fetchOne<Out>(
        shape?:
            | QueryShapeFunction<HydratedQueryResult<TBaseResult, THydrated>, Out>
            | QueryShapeParser<HydratedQueryResult<TBaseResult, THydrated>, Out>
    ): Promise<HydratedQueryResult<TBaseResult, THydrated> | Out | null> {
        const limited = this.limit(1);
        const result = !shape
            ? await limited.fetch()
            : typeof shape === 'function'
              ? await limited.fetch(shape)
              : await limited.fetch(shape);
        for (const row of result) {
            return row;
        }
        return null;
    }

    async first(): Promise<HydratedQueryResult<TBaseResult, THydrated> | null>;
    async first<Out>(shape: QueryShapeFunction<HydratedQueryResult<TBaseResult, THydrated>, Out>): Promise<Out | null>;
    async first<Out>(shape: QueryShapeParser<HydratedQueryResult<TBaseResult, THydrated>, Out>): Promise<Out | null>;
    async first<TShape extends QueryShape<HydratedQueryResult<TBaseResult, THydrated>> | undefined>(
        shape?: TShape
    ): Promise<
        | HydratedQueryResult<TBaseResult, THydrated>
        | QueryShapeOutput<HydratedQueryResult<TBaseResult, THydrated>, NonNullable<TShape>>
        | null
    > {
        return this.fetchOne(shape as never);
    }

    async last(): Promise<HydratedQueryResult<TBaseResult, THydrated> | null>;
    async last<Out>(shape: QueryShapeFunction<HydratedQueryResult<TBaseResult, THydrated>, Out>): Promise<Out | null>;
    async last<Out>(shape: QueryShapeParser<HydratedQueryResult<TBaseResult, THydrated>, Out>): Promise<Out | null>;
    async last<TShape extends QueryShape<HydratedQueryResult<TBaseResult, THydrated>> | undefined>(
        shape?: TShape
    ): Promise<
        | HydratedQueryResult<TBaseResult, THydrated>
        | QueryShapeOutput<HydratedQueryResult<TBaseResult, THydrated>, NonNullable<TShape>>
        | null
    > {
        if (this.state.limit !== undefined || this.state.offset !== undefined) {
            const page = await this.fetch();
            const row = page.at(-1);
            if (!row) {
                return null;
            }
            return this.shapeFetchedRow(row, shape as never) as
                | HydratedQueryResult<TBaseResult, THydrated>
                | QueryShapeOutput<HydratedQueryResult<TBaseResult, THydrated>, NonNullable<TShape>>;
        }

        const invertedOrder = QuerySet.invertOrderSpec(this.state.order);
        const effectiveOrder =
            invertedOrder.length > 0
                ? invertedOrder
                : [{ by: this.executor.meta.pk as keyof TModel, dir: InternalDirection.DESC }];
        const qs = this.spawn({ ...this.state, order: effectiveOrder });
        return qs.limit(1).fetchOne(shape as never);
    }

    async get(
        q: FilterInput<TModel, TSourceModel> | QNode<TModel, TSourceModel>
    ): Promise<HydratedQueryResult<TBaseResult, THydrated>>;
    async get<Out>(
        q: FilterInput<TModel, TSourceModel> | QNode<TModel, TSourceModel>,
        shape: QueryShapeFunction<HydratedQueryResult<TBaseResult, THydrated>, Out>
    ): Promise<Out>;
    async get<Out>(
        q: FilterInput<TModel, TSourceModel> | QNode<TModel, TSourceModel>,
        shape: QueryShapeParser<HydratedQueryResult<TBaseResult, THydrated>, Out>
    ): Promise<Out>;
    async get<TShape extends QueryShape<HydratedQueryResult<TBaseResult, THydrated>> | undefined>(
        q: FilterInput<TModel, TSourceModel> | QNode<TModel, TSourceModel>,
        shape?: TShape
    ): Promise<
        | HydratedQueryResult<TBaseResult, THydrated>
        | QueryShapeOutput<HydratedQueryResult<TBaseResult, THydrated>, NonNullable<TShape>>
    > {
        const limited = this.filter(q).limit(2);
        const page = await limited.fetch();
        const rows = page.items;

        if (rows.length === 0) {
            throw new NotFoundError(`${this.executor.meta.table}: no matching record`);
        }
        if (rows.length > 1) {
            throw new MultipleObjectsReturned(`${this.executor.meta.table}: more than one matching record`);
        }

        return this.shapeFetchedRow(rows[0]!, shape as never) as
            | HydratedQueryResult<TBaseResult, THydrated>
            | QueryShapeOutput<HydratedQueryResult<TBaseResult, THydrated>, NonNullable<TShape>>;
    }

    /**
     * Execute a `COUNT(*)` query for the current filtered state.
     */
    async count(): Promise<number> {
        const compiler = new QueryCompiler(this.executor.meta, this.executor.adapter);
        const compiled = compiler.compile(this.withoutHydrationState());
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

    private shapeFetchedRow<Out>(
        row: HydratedQueryResult<TBaseResult, THydrated>,
        shape?:
            | QueryShapeFunction<HydratedQueryResult<TBaseResult, THydrated>, Out>
            | QueryShapeParser<HydratedQueryResult<TBaseResult, THydrated>, Out>
    ): HydratedQueryResult<TBaseResult, THydrated> | Out {
        if (!shape) {
            return row;
        }

        if (typeof shape === 'function') {
            return shape(row);
        }

        const normalizedRow = this.normalizeHydratedRowsForParserShape([row])[0] ?? row;
        return shape.parse(normalizedRow);
    }

    private getOrCreateEvaluationCache(): Promise<QueryResult<HydratedQueryResult<TBaseResult, THydrated>>> {
        if (!this.evaluationCache) {
            this.evaluationCache = this.evaluateRows().catch((error) => {
                this.evaluationCache = undefined;
                throw error;
            });
        }
        return this.evaluationCache;
    }

    private async evaluateRows(): Promise<QueryResult<HydratedQueryResult<TBaseResult, THydrated>>> {
        const compiler = new QueryCompiler(this.executor.meta, this.executor.adapter);
        const compiled = compiler.compile(this.state);
        const rows = await this.executor.run(compiled);
        const normalizedRows = this.normalizeRowsForSchemaParsing(rows);
        const hydratedRows = await this.hydrateRows(normalizedRows as unknown as Record<string, unknown>[], compiled);
        this.attachRootRecordAccessors(hydratedRows);
        const projectedRows = hydratedRows as Array<HydratedQueryResult<TBaseResult, THydrated>>;
        return new QueryResult(projectedRows);
    }

    private normalizeRowsForSchemaParsing(rows: readonly TModel[]): TModel[] {
        if (this.executor.adapter.dialect !== InternalDialect.SQLITE) {
            return [...rows];
        }

        const booleanColumns = Object.entries(this.executor.meta.columns)
            .filter(([, value]) => this.isBooleanColumnType(value))
            .map(([column]) => column);

        if (booleanColumns.length === 0) {
            return [...rows];
        }

        return rows.map((row) => this.normalizeBooleanColumns(row, booleanColumns));
    }

    private normalizeHydratedRowsForParserShape(
        rows: readonly HydratedQueryResult<TBaseResult, THydrated>[]
    ): Array<HydratedQueryResult<TBaseResult, THydrated>> {
        if (this.executor.adapter.dialect !== InternalDialect.SQLITE) {
            return [...rows];
        }

        const booleanColumns = Object.entries(this.executor.meta.columns)
            .filter(([, value]) => this.isBooleanColumnType(value))
            .map(([column]) => column);

        if (booleanColumns.length === 0) {
            return [...rows];
        }

        return rows.map((row) => this.normalizeBooleanColumns(row, booleanColumns));
    }

    private async hydrateRows(
        rows: Record<string, unknown>[],
        compiled: CompiledQuery
    ): Promise<Record<string, unknown>[]> {
        if (!compiled.hydrationPlan) {
            return rows;
        }

        // Hydration mutates row objects by attaching related entities and
        // stripping internal alias columns. Copy once here so the executor's
        // raw rows remain untouched throughout the recursive hydration pass.
        const hydratedRows = rows.map((row) => ({ ...row }));
        // Canonicalize by model key and primary key so one database row maps to
        // one in-memory object even when multiple hydration paths reach it.
        this.attachRootRecordAccessors(hydratedRows);
        const canonicalEntities = new Map<string, Map<string | number, Record<string, unknown>>>();
        const queuedJoinPrefetchOwners = new Map<CompiledHydrationNode, Set<Record<string, unknown>>>();
        const compiler = new QueryCompiler(this.executor.meta, this.executor.adapter);

        for (const row of hydratedRows) {
            this.hydrateJoinNodesForOwner(
                row,
                row,
                compiled.hydrationPlan.joinNodes,
                canonicalEntities,
                queuedJoinPrefetchOwners
            );
        }

        for (const node of compiled.hydrationPlan.prefetchNodes) {
            await this.hydratePrefetchNode(node, hydratedRows, canonicalEntities, compiler);
        }

        for (const [node, owners] of queuedJoinPrefetchOwners.entries()) {
            await this.hydratePrefetchNode(node, [...owners], canonicalEntities, compiler);
        }

        for (const row of hydratedRows) {
            for (const alias of compiled.hydrationPlan.hiddenRootAliases) {
                delete row[alias];
            }
        }

        return hydratedRows;
    }

    private primeManyToManyOwnerCache(
        owner: Record<string, unknown>,
        relationName: string,
        bucket: readonly Record<string, unknown>[]
    ): void {
        const existing = owner[relationName];
        if (existing && typeof (existing as { primePrefetchCache?: unknown }).primePrefetchCache === 'function') {
            (existing as { primePrefetchCache: (rows: readonly Record<string, unknown>[]) => void }).primePrefetchCache(
                bucket
            );
            return;
        }
        owner[relationName] = bucket.slice();
    }

    private attachRootRecordAccessors(rows: readonly Record<string, unknown>[]): void {
        if (!this.executor.attachPersistedRecordAccessors) {
            return;
        }
        const sourceModelKey = this.executor.meta.modelKey;
        for (const row of rows) {
            this.executor.attachPersistedRecordAccessors(row, sourceModelKey);
        }
    }

    private hydrateJoinNodesForOwner(
        owner: Record<string, unknown>,
        rawRow: Record<string, unknown>,
        nodes: readonly CompiledHydrationNode[],
        canonicalEntities: Map<string, Map<string | number, Record<string, unknown>>>,
        queuedJoinPrefetchOwners?: Map<CompiledHydrationNode, Set<Record<string, unknown>>>
    ): void {
        // Join-backed descendants already live on the current SQL row. This
        // pass reads the aliased columns, materializes the related entity, and
        // then recurses into any join-backed children on the same row payload.
        for (const node of nodes) {
            if (!node.join) {
                continue;
            }

            const target: Record<string, unknown> = {};
            let hasTargetValue = false;

            for (const [column, alias] of Object.entries(node.join.columns)) {
                const value = rawRow[alias];
                delete rawRow[alias];
                target[column] = this.normalizeColumnValue(node.targetColumns[column], value);
                if (value !== null && value !== undefined) {
                    hasTargetValue = true;
                }
            }

            if (!hasTargetValue) {
                owner[node.relationName] = null;
                continue;
            }

            const canonical = this.canonicalizeEntity(node, target, canonicalEntities);
            owner[node.relationName] = canonical;
            for (const childNode of node.prefetchChildren) {
                const queuedOwners = queuedJoinPrefetchOwners?.get(childNode);
                if (queuedOwners) {
                    queuedOwners.add(canonical);
                    continue;
                }

                queuedJoinPrefetchOwners?.set(childNode, new Set([canonical]));
            }
            this.hydrateJoinNodesForOwner(
                canonical,
                rawRow,
                node.joinChildren,
                canonicalEntities,
                queuedJoinPrefetchOwners
            );
        }
    }

    private async hydratePrefetchNode(
        node: CompiledHydrationNode,
        owners: readonly Record<string, unknown>[],
        canonicalEntities: Map<string, Map<string | number, Record<string, unknown>>>,
        compiler: QueryCompiler
    ): Promise<void> {
        if (owners.length === 0) {
            return;
        }

        // Prefetch-backed descendants run as follow-up queries keyed by the
        // owner rows produced so far. Initialize defaults first so missing
        // children still hydrate to [] or null deterministically.
        const groupedOwners = this.groupOwnersByAccessor(owners, node.ownerSourceAccessor);
        const sourceValues = [...groupedOwners.keys()];
        const isManyToMany = !!node.throughTable;
        if (!isManyToMany) {
            for (const owner of owners) {
                owner[node.relationName] = node.cardinality === InternalRelationHydrationCardinality.MANY ? [] : null;
            }
        }

        if (sourceValues.length === 0) {
            return;
        }

        const sourceChunks = this.chunkValues(sourceValues, 500);
        const compiledPrefetch = compiler.compilePrefetch(node, sourceChunks[0]!);
        if (compiledPrefetch.kind === InternalPrefetchQueryKind.MANY_TO_MANY) {
            const idsByOwner = new Map<string | number, Array<string | number>>();
            const uniqueTargetIds = new Set<string | number>();

            for (const chunk of sourceChunks) {
                const chunkCompiled = compiler.compilePrefetch(node, chunk) as Extract<
                    typeof compiledPrefetch,
                    { kind: typeof InternalPrefetchQueryKind.MANY_TO_MANY }
                >;
                const throughResult = await this.executor.client.query<Record<string, unknown>>(
                    chunkCompiled.throughSql,
                    chunkCompiled.throughParams
                );

                for (const row of throughResult.rows) {
                    const ownerId = row[chunkCompiled.ownerAlias];
                    const targetId = row[chunkCompiled.targetAlias];
                    if (
                        (typeof ownerId !== 'string' && typeof ownerId !== 'number') ||
                        (typeof targetId !== 'string' && typeof targetId !== 'number')
                    ) {
                        continue;
                    }
                    const bucket = idsByOwner.get(ownerId) ?? [];
                    bucket.push(targetId);
                    idsByOwner.set(ownerId, bucket);
                    uniqueTargetIds.add(targetId);
                }
            }

            const targets: Record<string | number, Record<string, unknown>> = {};
            const targetIds = [...uniqueTargetIds.values()];
            if (targetIds.length > 0) {
                for (const targetChunk of this.chunkValues(targetIds, 500)) {
                    const targetQuery = compiler.compileManyToManyTargets(node, targetChunk);
                    const targetResult = await this.executor.client.query<Record<string, unknown>>(
                        targetQuery.sql,
                        targetQuery.params
                    );

                    for (const rawTargetRow of targetResult.rows) {
                        const normalized = this.normalizeTargetRow(
                            { targetColumns: compiledPrefetch.targetColumns },
                            rawTargetRow
                        );
                        const canonical = this.canonicalizeEntity(node, normalized, canonicalEntities);
                        this.hydrateJoinNodesForOwner(canonical, normalized, node.joinChildren, canonicalEntities);
                        const primaryKey = canonical[node.targetPrimaryKey];
                        if (typeof primaryKey === 'string' || typeof primaryKey === 'number') {
                            targets[primaryKey] = canonical;
                        }
                    }
                }
            }

            const canonicalChildren = new Map<string | number, Record<string, unknown>>();
            const handledOwners = new Set<Record<string, unknown>>();
            for (const [ownerId, ids] of idsByOwner.entries()) {
                const bucket = ids
                    .map((id) => targets[id])
                    .filter((value): value is Record<string, unknown> => !!value);
                for (const owner of groupedOwners.get(ownerId) ?? []) {
                    this.primeManyToManyOwnerCache(owner, node.relationName, bucket);
                    handledOwners.add(owner);
                }
                for (const child of bucket) {
                    canonicalChildren.set(child[node.targetPrimaryKey] as string | number, child);
                }
            }
            for (const owner of owners) {
                if (!handledOwners.has(owner)) {
                    this.primeManyToManyOwnerCache(owner, node.relationName, []);
                }
            }

            const childOwners = [...canonicalChildren.values()];
            for (const childNode of node.prefetchChildren) {
                await this.hydratePrefetchNode(childNode, childOwners, canonicalEntities, compiler);
            }
            return;
        }

        const canonicalChildren = new Map<string | number, Record<string, unknown>>();
        for (const chunk of sourceChunks) {
            const chunkCompiled = compiler.compilePrefetch(node, chunk) as Extract<
                typeof compiledPrefetch,
                { kind: typeof InternalPrefetchQueryKind.DIRECT }
            >;
            const result = await this.executor.client.query<Record<string, unknown>>(
                chunkCompiled.sql,
                chunkCompiled.params
            );

            for (const rawResultRow of result.rows) {
                const normalized = this.normalizeTargetRow(chunkCompiled, rawResultRow);
                const canonical = this.canonicalizeEntity(node, normalized, canonicalEntities);
                this.hydrateJoinNodesForOwner(canonical, normalized, node.joinChildren, canonicalEntities);

                const key = normalized[chunkCompiled.targetKey];
                if (typeof key !== 'string' && typeof key !== 'number') {
                    continue;
                }

                for (const owner of groupedOwners.get(key) ?? []) {
                    if (node.cardinality === InternalRelationHydrationCardinality.MANY) {
                        (owner[node.relationName] as Record<string, unknown>[]).push(canonical);
                    } else if (owner[node.relationName] === null) {
                        owner[node.relationName] = canonical;
                    }
                }

                const childPrimaryKey = canonical[node.targetPrimaryKey];
                if (typeof childPrimaryKey === 'string' || typeof childPrimaryKey === 'number') {
                    canonicalChildren.set(childPrimaryKey, canonical);
                }
            }
        }

        const childOwners = [...canonicalChildren.values()];
        for (const childNode of node.prefetchChildren) {
            await this.hydratePrefetchNode(childNode, childOwners, canonicalEntities, compiler);
        }
    }

    private chunkValues<T>(values: readonly T[], size: number): T[][] {
        if (values.length === 0) {
            return [];
        }
        if (values.length <= size) {
            return [Array.from(values)];
        }
        const chunks: T[][] = [];
        for (let i = 0; i < values.length; i += size) {
            chunks.push(values.slice(i, i + size) as T[]);
        }
        return chunks;
    }

    private groupOwnersByAccessor(
        owners: readonly Record<string, unknown>[],
        accessor: string
    ): Map<string | number, Record<string, unknown>[]> {
        const grouped = new Map<string | number, Record<string, unknown>[]>();

        for (const owner of owners) {
            const key = owner[accessor];
            if (typeof key !== 'string' && typeof key !== 'number') {
                continue;
            }
            const bucket = grouped.get(key) ?? [];
            bucket.push(owner);
            grouped.set(key, bucket);
        }

        return grouped;
    }

    private canonicalizeEntity(
        node: CompiledHydrationNode,
        row: Record<string, unknown>,
        canonicalEntities: Map<string, Map<string | number, Record<string, unknown>>>
    ): Record<string, unknown> {
        // Mixed join/prefetch traversal can encounter the same related row more
        // than once. Canonicalization ensures all later descendants attach to
        // one stable object graph instead of competing copies.
        const primaryKeyValue = row[node.targetPrimaryKey];
        if (typeof primaryKeyValue !== 'string' && typeof primaryKeyValue !== 'number') {
            return row;
        }

        const byModel =
            canonicalEntities.get(node.targetModelKey) ?? new Map<string | number, Record<string, unknown>>();
        const existing = byModel.get(primaryKeyValue);
        if (existing) {
            Object.assign(existing, row);
            return existing;
        }

        byModel.set(primaryKeyValue, row);
        canonicalEntities.set(node.targetModelKey, byModel);
        this.executor.attachPersistedRecordAccessors?.(row, node.targetModelKey);
        return row;
    }

    private normalizeTargetRow(prefetch: TargetColumnMetadata, row: Record<string, unknown>): Record<string, unknown> {
        if (this.executor.adapter.dialect !== InternalDialect.SQLITE) {
            return row;
        }

        let normalized: Record<string, unknown> | null = null;
        for (const [column, type] of Object.entries(prefetch.targetColumns)) {
            if (!this.isBooleanColumnType(type)) {
                continue;
            }
            const next = this.normalizeSqliteBoolean(row[column]);
            if (next === row[column]) {
                continue;
            }
            normalized ??= { ...row };
            normalized[column] = next;
        }
        return normalized ?? row;
    }

    private normalizeColumnValue(columnType: string | undefined, value: unknown): unknown {
        return this.executor.adapter.dialect === InternalDialect.SQLITE && this.isBooleanColumnType(columnType)
            ? this.normalizeSqliteBoolean(value)
            : value;
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

    private normalizeBooleanColumns<TRow extends Record<string, unknown>>(row: TRow, columns: readonly string[]): TRow {
        let normalized: TRow | null = null;

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

    private withoutHydrationState(): QuerySetState<TModel, TSourceModel> {
        const { selectRelated: _selectRelated, prefetchRelated: _prefetchRelated, ...rest } = this.state;
        return rest;
    }
}
