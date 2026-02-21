import type { GenericModelFactory } from '../factories';

/**
 * Assertion helpers for Tango models.
 */
export const assertions = {
    matchesSchema<TModel extends GenericModelFactory<Record<string, unknown>, unknown>>(
        model: TModel,
        data: unknown
    ): asserts data is ReturnType<TModel['parse']> {
        model.parse(data);
    },
};
