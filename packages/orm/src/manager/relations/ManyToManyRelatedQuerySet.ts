/*
 * Maintainer note: This subclass exists rather than a plain `QuerySet` so
 * that the related-manager can thread a prefetch-cache short-circuit and a
 * two-phase fetch through the join table without dragging many-to-many
 * knowledge into the base `QuerySet`.
 *
 * 1. Prefetch-cache short-circuit. When `prefetchRelated(...)` loads the
 *    relation ahead of time, the manager primes a cache that the first
 *    `fetch()` resolves with directly. Mutations via `add`/`remove`
 *    invalidate it.
 * 2. Two-phase fetch through the join table. On cache miss (or once the
 *    caller adds chainable state), the queryset asks the bridge for the
 *    linked target primary keys and then runs a vanilla target-table query
 *    scoped by `pk__in = [...]`. This keeps the compiled SQL identical to
 *    what a direct `TargetModel.objects.query()` would produce and avoids
 *    joining the through table into the projection.
 * 3. Chain preservation. Fluent queryset methods reuse the same
 *    subclass-preserving `spawn(...)` path as the rest of the ORM surface,
 *    so chains like `post.tags.all().select(['id']).orderBy('name').fetch()`
 *    keep the owner scoping and cache semantics instead of falling back to
 *    the model-backed queryset family.
 */
import type { QueryResult } from '../../query/domain/QueryResult';
import type { QuerySetState } from '../../query/domain/QuerySetState';
import type { FilterInput } from '../../query/domain/FilterInput';
import type { QNode } from '../../query/domain/QNode';
import type { QueryExecutor } from '../../query/index';
import { ModelQuerySet, QueryResult as QueryResultClass } from '../../query/index';
import { QuerySet } from '../../query/index';
import { InternalQNodeType } from '../../query/domain/internal/InternalQNodeType';
import { QBuilder as Q } from '../../query/QBuilder';

/**
 * Hooks supplied by {@link ManyToManyRelatedManager} so the queryset returned
 * from `all()` can short-circuit to the prefetch cache, scope the SQL query
 * to the owner via the join table, and filter targets by the resolved primary
 * keys.
 *
 * Application code does not construct this bridge directly; it is wired by
 * the related manager when `all()` is called.
 */
export interface ManyToManyRelatedQuerySetBridge<TTarget extends Record<string, unknown>> {
    getCache(): readonly TTarget[] | null;
    fetchTargetIds(): Promise<readonly (string | number)[]>;
    targetPrimaryKeyField: string;
}

type ShapeFunction<TInput, Out> = (row: TInput) => Out;
type ShapeParser<TInput, Out> = { parse: (row: TInput) => Out };
type Shape<TInput, Out> = ShapeFunction<TInput, Out> | ShapeParser<TInput, Out>;

function applyShape<TInput, Out>(rows: readonly TInput[], shape: Shape<TInput, Out>): Out[] {
    return typeof shape === 'function' ? rows.map(shape) : rows.map((row) => shape.parse(row));
}

/**
 * {@link QuerySet} returned by `post.tags.all()` on a many-to-many related
 * manager.
 *
 * Behaves like a normal `QuerySet` over the target model from an application
 * developer's perspective: you can chain `filter`, `exclude`, `orderBy`,
 * `limit`, `offset`, and terminate with `fetch`, `fetchOne`, or `count`.
 * Each chainable call returns another `ManyToManyRelatedQuerySet` so the
 * chain keeps the membership scoping of the owning record.
 *
 * Two behaviors differ from a plain `QuerySet` and matter to application
 * developers:
 *
 * - When the relation was loaded by `prefetchRelated(...)` and no chainable
 *   state has been added (no `filter`, `orderBy`, etc.), `fetch()` and
 *   `count()` resolve from the prefetch cache without issuing SQL.
 * - Mutating the membership via `post.tags.add(tag)` or
 *   `post.tags.remove(tag)` invalidates that cache so follow-up reads go
 *   back to the database.
 *
 * @example
 * ```ts
 * const post = await PostModel.objects.getOrThrow(postId);
 * await post.tags.add(tag);
 * const tags = await post.tags.all().filter({ color: 'red' }).orderBy('name').fetch();
 * ```
 *
 * @template TTarget - The persisted target record shape (e.g. `Tag`).
 */
export class ManyToManyRelatedQuerySet<TTarget extends Record<string, unknown>> extends QuerySet<TTarget> {
    constructor(
        executor: QueryExecutor<TTarget>,
        private readonly bridge: ManyToManyRelatedQuerySetBridge<TTarget>,
        state: QuerySetState<TTarget> = {}
    ) {
        super(executor, state);
    }

    override async fetch<Out>(
        shape?: ShapeFunction<TTarget, Out> | ShapeParser<TTarget, Out>
    ): Promise<QueryResult<TTarget | Out>> {
        if (this.isStateTrivial()) {
            const cache = this.bridge.getCache();
            if (cache !== null) {
                const results: Array<TTarget | Out> = shape ? applyShape(cache, shape) : [...cache];
                return new QueryResultClass(results);
            }
        }
        const ids = await this.bridge.fetchTargetIds();
        if (ids.length === 0) {
            return new QueryResultClass([]);
        }
        const scopedQs = new ModelQuerySet<TTarget>(this.executor, this.scopedState(ids));
        return shape ? scopedQs.fetch(shape) : scopedQs.fetch();
    }

    override async fetchOne<Out>(
        shape?: ShapeFunction<TTarget, Out> | ShapeParser<TTarget, Out>
    ): Promise<TTarget | Out | null> {
        const result = shape ? await this.fetch(shape) : await this.fetch();
        return (result.items[0] as TTarget | Out | undefined) ?? null;
    }

    override async count(): Promise<number> {
        if (this.isStateTrivial()) {
            const cache = this.bridge.getCache();
            if (cache !== null) {
                return cache.length;
            }
        }
        const ids = await this.bridge.fetchTargetIds();
        if (ids.length === 0) {
            return 0;
        }
        if (this.isStateTrivial()) {
            return ids.length;
        }
        const scopedQs = new ModelQuerySet<TTarget>(this.executor, this.scopedState(ids));
        return scopedQs.count();
    }

    protected override spawn<
        TNextBaseResult extends Record<string, unknown>,
        TNextHydrated extends Record<string, unknown>,
    >(state: QuerySetState<TTarget>): QuerySet<TTarget, TNextBaseResult, unknown, TNextHydrated> {
        return new ManyToManyRelatedQuerySet<TTarget>(this.executor, this.bridge, state) as QuerySet<
            TTarget,
            TNextBaseResult,
            unknown,
            TNextHydrated
        >;
    }

    private isStateTrivial(): boolean {
        return Object.keys(this.state).length === 0;
    }

    private scopedState(ids: readonly (string | number)[]): QuerySetState<TTarget> {
        const inFilter: FilterInput<TTarget> = {
            [`${this.bridge.targetPrimaryKeyField}__in`]: [...ids],
        } as FilterInput<TTarget>;
        const inAtom: QNode<TTarget> = { kind: InternalQNodeType.ATOM, where: inFilter };
        const merged = this.state.q ? Q.and(inAtom, this.state.q) : inAtom;
        return { ...this.state, q: merged };
    }
}
