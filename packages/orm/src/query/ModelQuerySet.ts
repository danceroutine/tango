/**
 * Maintainer note: model-backed and specialized relation-backed querysets
 * share the fluent API through `QuerySet.spawn(...)`. This concrete class
 * owns the direct "compile the accumulated state and execute it" path, while
 * subclasses preserve specialized execution behavior by returning their own
 * queryset family from `spawn(...)`.
 */
import type { QuerySetState } from './domain/QuerySetState';
import type { QueryExecutor } from './QuerySet';
import { QuerySet } from './QuerySet';

/**
 * Concrete `QuerySet` implementation returned by `Model.objects.query()`.
 *
 * It executes the accumulated queryset state directly against the bound
 * model executor.
 */
export class ModelQuerySet<
    TModel extends Record<string, unknown>,
    TBaseResult extends Record<string, unknown> = TModel,
    TSourceModel = unknown,
    THydrated extends Record<string, unknown> = Record<never, never>,
> extends QuerySet<TModel, TBaseResult, TSourceModel, THydrated> {
    constructor(executor: QueryExecutor<TModel>, state: QuerySetState<TModel, TSourceModel> = {}) {
        super(executor, state);
    }

    protected override spawn<
        TNextBaseResult extends Record<string, unknown> = TBaseResult,
        TNextHydrated extends Record<string, unknown> = THydrated,
    >(state: QuerySetState<TModel, TSourceModel>): ModelQuerySet<TModel, TNextBaseResult, TSourceModel, TNextHydrated> {
        return new ModelQuerySet<TModel, TNextBaseResult, TSourceModel, TNextHydrated>(this.executor, state);
    }
}
