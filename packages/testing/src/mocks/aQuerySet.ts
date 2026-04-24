import { getLogger } from '@danceroutine/tango-core';
import type { QuerySet } from '@danceroutine/tango-orm';
import { aModelQuerySet } from './aModelQuerySet';

const logger = getLogger('tango.testing.mocks');
// TODO this pattern keeps showing up, perhaps we should implement logger.warnOnce
let hasWarned = false;

/**
 * @deprecated Use `aModelQuerySet(...)` instead.
 */
export function aQuerySet<TModel extends Record<string, unknown>, TResult extends Record<string, unknown> = TModel>(
    overrides: Partial<QuerySet<TModel, TResult>> = {}
): QuerySet<TModel, TResult> {
    if (!hasWarned) {
        hasWarned = true;
        logger.warn('`aQuerySet(...)` is deprecated. Use `aModelQuerySet(...)` instead.');
    }

    return aModelQuerySet(overrides);
}
