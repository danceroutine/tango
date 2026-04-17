import type { QueryResult } from '@danceroutine/tango-orm/query';
import { QueryResult as QueryResultClass } from '@danceroutine/tango-orm/query';

/**
 * Create a query-result test value with optional overrides.
 */
export function aQueryResult<TModel>(overrides: Partial<QueryResult<TModel>> = {}): QueryResult<TModel> {
    return new QueryResultClass(overrides.results ?? ([] as TModel[]), { nextCursor: overrides.nextCursor ?? null });
}
