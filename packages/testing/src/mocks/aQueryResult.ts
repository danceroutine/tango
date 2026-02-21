import type { QueryResult } from '@danceroutine/tango-orm/query';

/**
 * Create a query-result test value with optional overrides.
 */
export function aQueryResult<TModel>(overrides: Partial<QueryResult<TModel>> = {}): QueryResult<TModel> {
    return {
        results: [] as TModel[],
        nextCursor: null,
        ...overrides,
    };
}
