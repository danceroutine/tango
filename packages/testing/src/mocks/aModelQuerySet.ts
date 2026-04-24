import { vi } from 'vitest';
import type { QuerySet } from '@danceroutine/tango-orm';
import { ModelQuerySet as QuerySetClass } from '@danceroutine/tango-orm';
import { aQueryResult } from './aQueryResult';
import { aQueryExecutor } from './aQueryExecutor';

/**
 * Create a chainable model-queryset test double with optional behavior overrides.
 *
 * All methods are wrapped in `vi.fn()` so they can be asserted on directly
 * without an additional `vi.mocked()` call.
 */
export function aModelQuerySet<
    TModel extends Record<string, unknown>,
    TResult extends Record<string, unknown> = TModel,
>(overrides: Partial<QuerySet<TModel, TResult>> = {}): QuerySet<TModel, TResult> {
    const queryset = new QuerySetClass<TModel, TResult>(aQueryExecutor<TModel>());
    const filterImpl: QuerySet<TModel, TResult>['filter'] = overrides.filter ?? ((_input) => queryset);
    const excludeImpl: QuerySet<TModel, TResult>['exclude'] = overrides.exclude ?? ((_input) => queryset);
    const orderByImpl: QuerySet<TModel, TResult>['orderBy'] = overrides.orderBy ?? ((..._tokens) => queryset);
    const limitImpl: QuerySet<TModel, TResult>['limit'] = overrides.limit ?? ((_n) => queryset);
    const offsetImpl: QuerySet<TModel, TResult>['offset'] = overrides.offset ?? ((_n) => queryset);
    const defaultSelect = ((_cols: readonly (keyof TModel)[]) => queryset) as unknown as QuerySet<
        TModel,
        TResult
    >['select'];
    const selectImpl = overrides.select ?? defaultSelect;
    const selectRelatedImpl =
        (overrides.selectRelated as ((...rels: readonly string[]) => QuerySet<TModel, TResult>) | undefined) ??
        ((..._rels: readonly string[]) => queryset);
    const prefetchRelatedImpl =
        (overrides.prefetchRelated as ((...rels: readonly string[]) => QuerySet<TModel, TResult>) | undefined) ??
        ((..._rels: readonly string[]) => queryset);
    const fetchImpl: QuerySet<TModel, TResult>['fetch'] =
        overrides.fetch ??
        (async <Out = TResult>(_shape?: ((r: TResult) => Out) | { parse: (r: TResult) => Out }) => aQueryResult<Out>());
    const fetchOneImpl: QuerySet<TModel, TResult>['fetchOne'] =
        overrides.fetchOne ??
        (async <Out = TResult>(_shape?: ((r: TResult) => Out) | { parse: (r: TResult) => Out }) => null as Out | null);
    const countImpl: QuerySet<TModel, TResult>['count'] = overrides.count ?? (async () => 0);
    const existsImpl: QuerySet<TModel, TResult>['exists'] = overrides.exists ?? (async () => false);

    queryset.filter = vi.fn((input: Parameters<QuerySet<TModel, TResult>['filter']>[0]) =>
        filterImpl(input)
    ) as QuerySet<TModel, TResult>['filter'];
    queryset.exclude = vi.fn((input: Parameters<QuerySet<TModel, TResult>['exclude']>[0]) =>
        excludeImpl(input)
    ) as QuerySet<TModel, TResult>['exclude'];
    queryset.orderBy = vi.fn((...tokens: Parameters<QuerySet<TModel, TResult>['orderBy']>) =>
        orderByImpl(...tokens)
    ) as QuerySet<TModel, TResult>['orderBy'];
    queryset.limit = vi.fn((n: number) => limitImpl(n)) as QuerySet<TModel, TResult>['limit'];
    queryset.offset = vi.fn((n: number) => offsetImpl(n)) as QuerySet<TModel, TResult>['offset'];
    queryset.select = vi.fn((cols: Parameters<QuerySet<TModel, TResult>['select']>[0]) =>
        selectImpl(cols)
    ) as unknown as QuerySet<TModel, TResult>['select'];
    queryset.selectRelated = vi.fn((...rels: readonly string[]) => selectRelatedImpl(...rels)) as unknown as QuerySet<
        TModel,
        TResult
    >['selectRelated'];
    queryset.prefetchRelated = vi.fn((...rels: readonly string[]) =>
        prefetchRelatedImpl(...rels)
    ) as unknown as QuerySet<TModel, TResult>['prefetchRelated'];
    queryset.fetch = vi.fn(fetchImpl) as unknown as QuerySet<TModel, TResult>['fetch'];
    queryset.fetchOne = vi.fn(fetchOneImpl) as unknown as QuerySet<TModel, TResult>['fetchOne'];
    queryset.count = vi.fn(() => countImpl()) as QuerySet<TModel, TResult>['count'];
    queryset.exists = vi.fn(() => existsImpl()) as QuerySet<TModel, TResult>['exists'];

    return queryset;
}
