import { vi } from 'vitest';
import type { ManagerLike, QuerySet } from '@danceroutine/tango-orm';
import type { TableMeta } from '@danceroutine/tango-orm/query';
import { aQuerySet } from './aQuerySet';

export type ManagerOverrides<TModel extends Record<string, unknown>> = {
    meta?: TableMeta;
    querySet?: QuerySet<TModel>;
    query?: ManagerLike<TModel>['query'];
    findById?: ManagerLike<TModel>['findById'];
    getOrThrow?: ManagerLike<TModel>['getOrThrow'];
    create?: ManagerLike<TModel>['create'];
    update?: ManagerLike<TModel>['update'];
    delete?: ManagerLike<TModel>['delete'];
    bulkCreate?: ManagerLike<TModel>['bulkCreate'];
};

/**
 * Create a manager-shaped test double for resource and service tests.
 */
export function aManager<TModel extends Record<string, unknown>>(
    overrides: ManagerOverrides<TModel> = {}
): ManagerLike<TModel> {
    const meta = overrides.meta ?? { table: 'mock_table', pk: 'id', columns: {} };
    const querySet = overrides.querySet ?? aQuerySet<TModel>();
    type ModelId = TModel[keyof TModel];

    const queryImpl = overrides.query ?? (() => querySet);
    const findByIdImpl = overrides.findById ?? (async () => null as TModel | null);
    const getOrThrowImpl =
        overrides.getOrThrow ??
        (async (id: ModelId) => {
            const record = await findByIdImpl(id);
            if (!record) {
                throw new Error(`No ${meta.table} record found for ${String(meta.pk)}=${String(id)}.`);
            }
            return record;
        });
    const createImpl = overrides.create ?? (async (input: Partial<TModel>) => input as TModel);
    const updateImpl = overrides.update ?? (async (_id: ModelId, patch: Partial<TModel>) => patch as TModel);
    const deleteImpl = overrides.delete ?? (async (_id: ModelId) => {});
    const bulkCreateImpl = overrides.bulkCreate ?? (async (inputs: Partial<TModel>[]) => inputs as TModel[]);

    return {
        meta,
        query: vi.fn(() => queryImpl()),
        findById: vi.fn((id: ModelId) => findByIdImpl(id)),
        getOrThrow: vi.fn((id: ModelId) => getOrThrowImpl(id)),
        create: vi.fn((input: Partial<TModel>) => createImpl(input)),
        update: vi.fn((id: ModelId, patch: Partial<TModel>) => updateImpl(id, patch)),
        delete: vi.fn((id: ModelId) => deleteImpl(id)),
        bulkCreate: vi.fn((inputs: Partial<TModel>[]) => bulkCreateImpl(inputs)),
    };
}
