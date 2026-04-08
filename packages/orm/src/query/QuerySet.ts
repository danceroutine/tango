import type { DBClient } from '../connection/clients/DBClient';
import type { Dialect } from './domain/Dialect';
import type { QuerySetState } from './domain/QuerySetState';
import type { TableMeta } from './domain/TableMeta';
import type { QNode } from './domain/QNode';
import type { QueryResult } from './domain/QueryResult';
import type { OrderToken } from './domain/OrderToken';
import type { FilterInput } from './domain/FilterInput';
import type { CompiledQuery } from './domain/CompiledQuery';
import type { CompiledPrefetchHydration } from './domain/CompiledQuery';
import type {
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
import { InternalDialect } from './domain/internal/InternalDialect';
import { InternalRelationKind } from './domain/internal/InternalRelationKind';
import { QBuilder as Q } from './QBuilder';
import { QueryCompiler } from './compiler';

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
    dialect: Dialect;
    run(compiled: CompiledQuery): Promise<TModel[]>;
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
 * one-level relation hydration.
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
export class QuerySet<
    TModel extends Record<string, unknown>,
    TBaseResult extends Record<string, unknown> = TModel,
    TSourceModel = unknown,
    THydrated extends Record<string, unknown> = Record<never, never>,
> {
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
    filter(q: FilterInput<TModel> | QNode<TModel>): QuerySet<TModel, TBaseResult, TSourceModel, THydrated> {
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
    exclude(q: FilterInput<TModel> | QNode<TModel>): QuerySet<TModel, TBaseResult, TSourceModel, THydrated> {
        const wrapped: QNode<TModel> = (q as QNode<TModel>).kind
            ? (q as QNode<TModel>)
            : { kind: InternalQNodeType.ATOM, where: q as FilterInput<TModel> };
        const excludes = [...(this.state.excludes ?? []), wrapped];
        return new QuerySet(this.executor, { ...this.state, excludes });
    }

    /**
     * Apply ordering tokens such as `'name'` or `'-createdAt'`.
     */
    orderBy(...tokens: OrderToken<TModel>[]): QuerySet<TModel, TBaseResult, TSourceModel, THydrated> {
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
    limit(n: number): QuerySet<TModel, TBaseResult, TSourceModel, THydrated> {
        return new QuerySet(this.executor, { ...this.state, limit: n });
    }

    /**
     * Skip the first `n` rows.
     */
    offset(n: number): QuerySet<TModel, TBaseResult, TSourceModel, THydrated> {
        return new QuerySet(this.executor, { ...this.state, offset: n });
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
        return new QuerySet(this.executor, { ...this.state, select: [...fields] as (keyof TModel)[] });
    }

    /**
     * Hydrate single-valued relations through SQL joins.
     *
     * Forward `belongsTo` relations can be inferred from the source model's
     * field-authored relation metadata. Reverse `hasOne` relations can be
     * selected with a target model generic when the target model points back to
     * the source model.
     */
    selectRelated<
        TTargetModel = undefined,
        const TRelationName extends RelationKeys<
            SelectRelatedRelations<TSourceModel, NoInfer<TTargetModel>>
        > = RelationKeys<SelectRelatedRelations<TSourceModel, NoInfer<TTargetModel>>>,
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
                TRelationName,
                SingleRelationHydrationCardinality
            >
    > {
        return new QuerySet(this.executor, { ...this.state, selectRelated: [...rels] });
    }

    /**
     * Hydrate collection relations with a follow-up query.
     *
     * Reverse `hasMany` relations can be prefetched with a target model generic
     * when the target model points back to the source model.
     */
    prefetchRelated<
        TTargetModel = undefined,
        const TRelationName extends RelationKeys<
            PrefetchRelatedRelations<TSourceModel, NoInfer<TTargetModel>>
        > = RelationKeys<PrefetchRelatedRelations<TSourceModel, NoInfer<TTargetModel>>>,
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
                TRelationName,
                ManyRelationHydrationCardinality
            >
    > {
        return new QuerySet(this.executor, { ...this.state, prefetchRelated: [...rels] });
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
        this.validateHydrationState();
        const compiler = new QueryCompiler(this.executor.meta, this.executor.dialect);
        const compiled = compiler.compile(this.state);
        const rows = await this.executor.run(compiled);
        const normalizedRows = this.normalizeRowsForSchemaParsing(rows, shape);
        const hydratedRows = await this.hydrateRows(normalizedRows as unknown as Record<string, unknown>[], compiled);
        const projectedRows = hydratedRows as Array<HydratedQueryResult<TBaseResult, THydrated>>;

        const results: Array<HydratedQueryResult<TBaseResult, THydrated> | Out> = !shape
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
        return result.results[0] ?? null;
    }

    /**
     * Execute a `COUNT(*)` query for the current filtered state.
     */
    async count(): Promise<number> {
        this.validateHydrationState();
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
        shape?:
            | QueryShapeFunction<HydratedQueryResult<TBaseResult, THydrated>, Out>
            | QueryShapeParser<HydratedQueryResult<TBaseResult, THydrated>, Out>
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

    private validateHydrationState(): void {
        const seen = new Set<string>();
        for (const relationName of [...(this.state.selectRelated ?? []), ...(this.state.prefetchRelated ?? [])]) {
            if (seen.has(relationName)) {
                throw new Error(`Relation '${relationName}' was requested more than once.`);
            }
            seen.add(relationName);

            const relation = this.executor.meta.relations?.[relationName];
            if (!relation) {
                throw new Error(`Unknown relation '${relationName}' for table '${this.executor.meta.table}'.`);
            }
            if (relation.kind === InternalRelationKind.MANY_TO_MANY) {
                throw new Error(`Relation '${relationName}' is many-to-many and cannot be hydrated yet.`);
            }
            if (
                relationName in this.executor.meta.columns &&
                !(relation.kind === InternalRelationKind.BELONGS_TO && relationName === relation.sourceKey)
            ) {
                throw new Error(
                    `Relation '${relationName}' on table '${this.executor.meta.table}' collides with an existing field.`
                );
            }
        }

        for (const relationName of this.state.selectRelated ?? []) {
            const relation = this.executor.meta.relations![relationName]!;
            if (relation.kind !== InternalRelationKind.BELONGS_TO && relation.kind !== InternalRelationKind.HAS_ONE) {
                throw new Error(`Relation '${relationName}' cannot be loaded with selectRelated(...).`);
            }
        }

        for (const relationName of this.state.prefetchRelated ?? []) {
            const relation = this.executor.meta.relations![relationName]!;
            if (relation.kind !== InternalRelationKind.HAS_MANY) {
                throw new Error(`Relation '${relationName}' cannot be loaded with prefetchRelated(...).`);
            }
        }
    }

    private async hydrateRows(
        rows: Record<string, unknown>[],
        compiled: CompiledQuery
    ): Promise<Record<string, unknown>[]> {
        const selectedRows = this.hydrateSelectedRows(rows, compiled);
        return this.hydratePrefetchedRows(selectedRows, compiled);
    }

    private hydrateSelectedRows(rows: Record<string, unknown>[], compiled: CompiledQuery): Record<string, unknown>[] {
        const hydrations = compiled.hydrations;
        if (!hydrations?.length) {
            return rows;
        }

        return rows.map((row) => {
            const next = { ...row };
            for (const hydration of hydrations) {
                const target: Record<string, unknown> = {};
                let hasTargetValue = false;

                for (const [column, alias] of Object.entries(hydration.columns)) {
                    const value = next[alias];
                    delete next[alias];
                    target[column] = this.normalizeTargetValue(hydration.relationName, column, value);
                    if (value !== null && value !== undefined) {
                        hasTargetValue = true;
                    }
                }

                next[hydration.relationName] = hasTargetValue ? target : null;
            }
            return next;
        });
    }

    private async hydratePrefetchedRows(
        rows: Record<string, unknown>[],
        compiled: CompiledQuery
    ): Promise<Record<string, unknown>[]> {
        if (!compiled.prefetches?.length || rows.length === 0) {
            return rows;
        }

        const prefetchGroups = await Promise.all(
            compiled.prefetches.map(async (prefetch) => {
                const sourceValues = rows
                    .map((row) => row[prefetch.sourceKeyAlias ?? prefetch.sourceKey])
                    .filter(
                        (value): value is string | number => typeof value === 'string' || typeof value === 'number'
                    );
                const uniqueSourceValues = [...new Set(sourceValues)];
                // TODO: A future prefetch planner can batch compatible relation fetches into fewer database
                // round trips. For now, prefetch is bounded by requested relation count, and each relation fetch is
                // issued concurrently instead of once per base row.
                return {
                    prefetch,
                    grouped: await this.fetchPrefetchGroup(prefetch, uniqueSourceValues),
                };
            })
        );

        const hiddenSourceAliases = new Set(
            compiled.prefetches
                .map((prefetch) => prefetch.sourceKeyAlias)
                .filter((alias): alias is string => typeof alias === 'string')
        );

        return rows.map((row) => {
            const next = { ...row };

            for (const { prefetch, grouped } of prefetchGroups) {
                const sourceValue = row[prefetch.sourceKeyAlias ?? prefetch.sourceKey];
                next[prefetch.relationName] =
                    typeof sourceValue === 'string' || typeof sourceValue === 'number'
                        ? (grouped.get(sourceValue) ?? [])
                        : [];
            }

            for (const alias of hiddenSourceAliases) {
                delete next[alias];
            }

            return next;
        });
    }

    private async fetchPrefetchGroup(
        prefetch: CompiledPrefetchHydration,
        sourceValues: readonly (string | number)[]
    ): Promise<Map<string | number, Record<string, unknown>[]>> {
        const compiledPrefetch = new QueryCompiler(this.executor.meta, this.executor.dialect).compilePrefetch(
            prefetch,
            sourceValues
        );
        const grouped = new Map<string | number, Record<string, unknown>[]>();
        if (sourceValues.length === 0) {
            return grouped;
        }

        const result = await this.executor.client.query<Record<string, unknown>>(
            compiledPrefetch.sql,
            compiledPrefetch.params
        );

        for (const row of result.rows) {
            const normalized = this.normalizeTargetRow(compiledPrefetch, row);
            const key = normalized[compiledPrefetch.targetKey];
            if (typeof key !== 'string' && typeof key !== 'number') {
                continue;
            }
            const bucket = grouped.get(key) ?? [];
            bucket.push(normalized);
            grouped.set(key, bucket);
        }

        return grouped;
    }

    private normalizeTargetRow(prefetch: TargetColumnMetadata, row: Record<string, unknown>): Record<string, unknown> {
        if (this.executor.dialect !== InternalDialect.SQLITE) {
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

    private normalizeTargetValue(relationName: string, column: string, value: unknown): unknown {
        if (this.executor.dialect !== InternalDialect.SQLITE) {
            return value;
        }
        const relation = this.executor.meta.relations![relationName]!;
        return this.isBooleanColumnType(relation.targetColumns[column]) ? this.normalizeSqliteBoolean(value) : value;
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
