import type { QueryResult } from '@danceroutine/tango-orm/query';
import { QueryResult as QueryResultClass } from '@danceroutine/tango-orm/query';

export type AQueryResultOverrides<TModel> = {
    items?: readonly TModel[];
    results?: readonly TModel[];
    nextCursor?: string | null;
};

/**
 * Create a query-result test value with optional overrides.
 */
export function aQueryResult<TModel>(overrides: AQueryResultOverrides<TModel> = {}): QueryResult<TModel> {
    const items = overrides.items ?? overrides.results ?? ([] as TModel[]);
    return new QueryResultClass(items, { nextCursor: overrides.nextCursor ?? null });
}
