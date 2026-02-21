import type { QuerySet } from '@danceroutine/tango-orm';

/**
 * Legacy alias for query-set test doubles.
 */
export type MockQuerySetResult<TModel extends Record<string, unknown>> = QuerySet<TModel>;
