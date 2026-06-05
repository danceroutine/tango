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
import { InternalQNodeType } from './domain/internal/InternalQNodeType';
import { InternalDirection } from './domain/internal/InternalDirection';
import { QBuilder as Q } from './QBuilder';
import { QueryCompiler } from './compiler';
import { isQNodeLike } from './internal/isQNodeLike';
import { QueryHydrator } from './hydration/QueryHydrator';
import {
    createQueryRowNormalizerStrategy,
    type QueryRowNormalizerStrategy,
} from './hydration/QueryRowNormalizerStrategy';
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
> implements AsyncIterable<HydratedQueryResult<TBaseResult, THydrated>> {
    static readonly BRAND = 'tango.orm.query_set' as const;
    readonly __tangoBrand: typeof QuerySet.BRAND = QuerySet.BRAND;
    private evaluationCache?: Promise<QueryResult<HydratedQueryResult<TBaseResult, THydrated>>>;
    private readonly hydrator: QueryHydrator<TModel>;
    private readonly rowNormalizer: QueryRowNormalizerStrategy;

    constructor(
        protected executor: QueryExecutor<TModel>,
        protected state: QuerySetState<TModel, TSourceModel> = {}
    ) {
        this.rowNormalizer = createQueryRowNormalizerStrategy(executor.adapter.dialect);
        this.hydrator = new QueryHydrator(executor, this.rowNormalizer);
    }

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

    private static validateQueryWindowBound(kind: 'limit' | 'offset', value: unknown): number {
        if (typeof value !== 'number') {
            throw new TypeError(`QuerySet.${kind}() expects a number.`);
        }

        if (!Number.isSafeInteger(value) || value < 0) {
            throw new RangeError(`QuerySet.${kind}() expects a non-negative safe integer.`);
        }

        return value;
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
        return this.spawn({ ...this.state, limit: QuerySet.validateQueryWindowBound('limit', n) });
    }

    /**
     * Skip the first `n` rows.
     */
    offset(n: number): QuerySet<TModel, TBaseResult, TSourceModel, THydrated> {
        return this.spawn({ ...this.state, offset: QuerySet.validateQueryWindowBound('offset', n) });
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
                : this.rowNormalizer
                      .normalizeHydratedRowsForParserShape(baseResult.items, this.executor.meta.columns)
                      .map((row) => shape.parse(row));

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
        const compiler = new QueryCompiler(this.executor.meta, this.executor.adapter);
        const compiled = compiler.compileExists(this.withoutHydrationState());
        const rows = await this.executor.client.query<{ tango_exists: number }>(compiled.sql, compiled.params);
        return rows.rows.length > 0;
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

        const normalizedRow = this.rowNormalizer.normalizeHydratedRowsForParserShape(
            [row],
            this.executor.meta.columns
        )[0]!;
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
        const normalizedRows = this.rowNormalizer.normalizeRootRows(rows, this.executor.meta.columns);
        const hydratedRows = await this.hydrator.materializeRows(normalizedRows, compiled);
        const projectedRows = hydratedRows as Array<HydratedQueryResult<TBaseResult, THydrated>>;
        return new QueryResult(projectedRows);
    }

    private withoutHydrationState(): QuerySetState<TModel, TSourceModel> {
        const { selectRelated: _selectRelated, prefetchRelated: _prefetchRelated, ...rest } = this.state;
        return rest;
    }
}
