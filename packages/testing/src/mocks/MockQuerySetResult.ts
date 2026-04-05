import type { QuerySet } from '@danceroutine/tango-orm';

/**
 * @deprecated Use QuerySet instead.
 * Legacy alias for query-set test doubles.
 */
export type MockQuerySetResult<
    TModel extends Record<string, unknown>,
    TResult extends Record<string, unknown> = TModel,
> = QuerySet<TModel, TResult>;
