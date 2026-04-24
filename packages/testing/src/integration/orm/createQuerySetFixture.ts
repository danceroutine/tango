import { getLogger } from '@danceroutine/tango-core';
import type { QuerySet } from '@danceroutine/tango-orm';
import type { TableMeta } from '@danceroutine/tango-orm/query';
import type { IntegrationHarness } from '../domain/index';
import { createModelQuerySetFixture } from './createModelQuerySetFixture';

const logger = getLogger('tango.testing.integration');
let hasWarned = false;

/**
 * @deprecated Use `createModelQuerySetFixture(...)` instead.
 */
export function createQuerySetFixture<TModel extends Record<string, unknown>>(input: {
    harness: IntegrationHarness;
    meta: TableMeta;
}): QuerySet<TModel> {
    if (!hasWarned) {
        hasWarned = true;
        logger.warn('`createQuerySetFixture(...)` is deprecated. Use `createModelQuerySetFixture(...)` instead.');
    }

    return createModelQuerySetFixture(input);
}
