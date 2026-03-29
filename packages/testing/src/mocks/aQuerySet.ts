import { vi } from 'vitest';
import type { QuerySet } from '@danceroutine/tango-orm';
import { QuerySet as QuerySetClass } from '@danceroutine/tango-orm';
import { aQueryResult } from './aQueryResult';
import { aQueryExecutor } from './aQueryExecutor';

/**
 * Create a chainable query-set test double with optional behavior overrides.
 *
 * All methods are wrapped in `vi.fn()` so they can be asserted on directly
 * without an additional `vi.mocked()` call.
 */
export function aQuerySet<TModel extends Record<string, unknown>>(
    overrides: Partial<QuerySet<TModel>> = {}
): QuerySet<TModel> {
    const queryset = new QuerySetClass<TModel>(aQueryExecutor<TModel>());
    const filterImpl: QuerySet<TModel>['filter'] = overrides.filter ?? ((_input) => queryset);
    const excludeImpl: QuerySet<TModel>['exclude'] = overrides.exclude ?? ((_input) => queryset);
    const orderByImpl: QuerySet<TModel>['orderBy'] = overrides.orderBy ?? ((..._tokens) => queryset);
    const limitImpl: QuerySet<TModel>['limit'] = overrides.limit ?? ((_n) => queryset);
    const offsetImpl: QuerySet<TModel>['offset'] = overrides.offset ?? ((_n) => queryset);
    const selectImpl: QuerySet<TModel>['select'] = overrides.select ?? ((_cols) => queryset);
    const selectRelatedImpl: QuerySet<TModel>['selectRelated'] = overrides.selectRelated ?? ((..._rels) => queryset);
    const prefetchRelatedImpl: QuerySet<TModel>['prefetchRelated'] =
        overrides.prefetchRelated ?? ((..._rels) => queryset);
    const fetchImpl: QuerySet<TModel>['fetch'] =
        overrides.fetch ??
        (async <Out = TModel>(_shape?: ((r: TModel) => Out) | { parse: (r: TModel) => Out }) => aQueryResult<Out>());
    const fetchOneImpl: QuerySet<TModel>['fetchOne'] =
        overrides.fetchOne ??
        (async <Out = TModel>(_shape?: ((r: TModel) => Out) | { parse: (r: TModel) => Out }) => null as Out | null);
    const countImpl: QuerySet<TModel>['count'] = overrides.count ?? (async () => 0);
    const existsImpl: QuerySet<TModel>['exists'] = overrides.exists ?? (async () => false);

    queryset.filter = vi.fn((input: Parameters<QuerySet<TModel>['filter']>[0]) =>
        filterImpl(input)
    ) as QuerySet<TModel>['filter'];
    queryset.exclude = vi.fn((input: Parameters<QuerySet<TModel>['exclude']>[0]) =>
        excludeImpl(input)
    ) as QuerySet<TModel>['exclude'];
    queryset.orderBy = vi.fn((...tokens: Parameters<QuerySet<TModel>['orderBy']>) =>
        orderByImpl(...tokens)
    ) as QuerySet<TModel>['orderBy'];
    queryset.limit = vi.fn((n: number) => limitImpl(n)) as QuerySet<TModel>['limit'];
    queryset.offset = vi.fn((n: number) => offsetImpl(n)) as QuerySet<TModel>['offset'];
    queryset.select = vi.fn((cols: Parameters<QuerySet<TModel>['select']>[0]) =>
        selectImpl(cols)
    ) as QuerySet<TModel>['select'];
    queryset.selectRelated = vi.fn((...rels: Parameters<QuerySet<TModel>['selectRelated']>) =>
        selectRelatedImpl(...rels)
    ) as QuerySet<TModel>['selectRelated'];
    queryset.prefetchRelated = vi.fn((...rels: Parameters<QuerySet<TModel>['prefetchRelated']>) =>
        prefetchRelatedImpl(...rels)
    ) as QuerySet<TModel>['prefetchRelated'];
    queryset.fetch = vi.fn(fetchImpl) as QuerySet<TModel>['fetch'];
    queryset.fetchOne = vi.fn(fetchOneImpl) as QuerySet<TModel>['fetchOne'];
    queryset.count = vi.fn(() => countImpl()) as QuerySet<TModel>['count'];
    queryset.exists = vi.fn(() => existsImpl()) as QuerySet<TModel>['exists'];

    return queryset;
}
