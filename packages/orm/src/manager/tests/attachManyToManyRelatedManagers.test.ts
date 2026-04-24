import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { z } from 'zod';
import { setupTestTangoRuntime } from '@danceroutine/tango-testing';
import { Model, ModelRegistry, t } from '@danceroutine/tango-schema';
import type { QueryExecutor } from '../../query/index';
import { getTangoRuntime } from '../../runtime/index';
import { ManyToManyRelatedManager } from '../index';
import type { MaterializedModelRecord } from '../relations/MaterializedModelRecord';
import { registerModelObjects } from '../registerModelObjects';

function getExecutor(manager: unknown): QueryExecutor<Record<string, unknown>> {
    return (manager as { queryExecutor: QueryExecutor<Record<string, unknown>> }).queryExecutor;
}

describe('ModelManager many-to-many related-manager attachment', () => {
    beforeEach(async () => {
        ModelRegistry.clear();
        registerModelObjects();
        await setupTestTangoRuntime();
    });

    it('attaches a related-manager accessor as a non-enumerable property on records of the source model', () => {
        const TagModel = Model({
            namespace: 'test',
            name: 'Tag',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });
        const PostModel = Model({
            namespace: 'test',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                tags: t.manyToMany(TagModel),
            }),
        });

        const record: Record<string, unknown> = { id: 1 };
        getExecutor(PostModel.objects).attachPersistedRecordAccessors!(record, PostModel.metadata.key);

        expect(ManyToManyRelatedManager.isManyToManyRelatedManager(record.tags)).toBe(true);
        expect(Object.keys(record)).toEqual(['id']);
        expect(JSON.parse(JSON.stringify(record))).toEqual({ id: 1 });
    });

    it('types named many-to-many accessors from the published relation name', () => {
        const TagModel = Model({
            namespace: 'test',
            name: 'Tag',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });
        const PostModel = Model({
            namespace: 'test',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                tagIds: t.manyToMany(TagModel, { name: 'tags' }),
            }),
        });

        type PostRecord = MaterializedModelRecord<typeof PostModel.schema>;

        expectTypeOf<PostRecord['tags']>().toMatchTypeOf<ManyToManyRelatedManager<{ id: number }>>();
    });

    it('skips relations that already carry a hydration-assigned value on the record', () => {
        const TagModel = Model({
            namespace: 'test',
            name: 'Tag',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });
        const PostModel = Model({
            namespace: 'test',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                tags: t.manyToMany(TagModel),
            }),
        });

        const record: Record<string, unknown> = { id: 1, tags: [{ id: 100 }] };
        getExecutor(PostModel.objects).attachPersistedRecordAccessors!(record, PostModel.metadata.key);

        expect(record.tags).toEqual([{ id: 100 }]);
    });

    it('does not attach when the materialized record is missing its primary key value', () => {
        const TagModel = Model({
            namespace: 'test',
            name: 'Tag',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });
        const PostModel = Model({
            namespace: 'test',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                tags: t.manyToMany(TagModel),
            }),
        });

        const record: Record<string, unknown> = { id: null };
        getExecutor(PostModel.objects).attachPersistedRecordAccessors!(record, PostModel.metadata.key);

        expect(ManyToManyRelatedManager.isManyToManyRelatedManager(record.tags)).toBe(false);
        expect(record.tags).toBeUndefined();
    });

    it('attaches managers for canonical entities of related models reached through the registry', () => {
        const TagModel = Model({
            namespace: 'test',
            name: 'Tag',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });
        const TopicModel = Model({
            namespace: 'test',
            name: 'Topic',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                tags: t.manyToMany(TagModel),
            }),
        });
        const PostModel = Model({
            namespace: 'test',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                topicId: t.foreignKey(TopicModel, { field: z.number().int() }),
            }),
        });

        const topicRecord: Record<string, unknown> = { id: 3 };
        getExecutor(PostModel.objects).attachPersistedRecordAccessors!(topicRecord, TopicModel.metadata.key);

        expect(ManyToManyRelatedManager.isManyToManyRelatedManager(topicRecord.tags)).toBe(true);
    });

    it('returns without attaching when the model key cannot be resolved from the registry', () => {
        const TagModel = Model({
            namespace: 'test',
            name: 'Tag',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });
        const PostModel = Model({
            namespace: 'test',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                tags: t.manyToMany(TagModel),
            }),
        });

        const record: Record<string, unknown> = { id: 1 };
        getExecutor(PostModel.objects).attachPersistedRecordAccessors!(record, 'test/UnknownModel');

        expect(ManyToManyRelatedManager.isManyToManyRelatedManager(record.tags)).toBe(false);
    });

    it('returns without attaching when no model key is supplied', () => {
        const PostModel = Model({
            namespace: 'test',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });

        const record: Record<string, unknown> = { id: 1 };
        getExecutor(PostModel.objects).attachPersistedRecordAccessors!(record, undefined);

        expect(record).toEqual({ id: 1 });
    });

    it('skips attachment for non-many-to-many relations on the source model', () => {
        const UserModel = Model({
            namespace: 'test',
            name: 'User',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });
        const PostModel = Model({
            namespace: 'test',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                authorId: t.foreignKey(UserModel, { field: z.number().int() }),
            }),
            relations: (r) => ({
                author: r.belongsTo('test/User', 'authorId'),
            }),
        });

        const record: Record<string, unknown> = { id: 1, authorId: 9 };
        getExecutor(PostModel.objects).attachPersistedRecordAccessors!(record, PostModel.metadata.key);

        expect(record.author).toBeUndefined();
        expect(ManyToManyRelatedManager.isManyToManyRelatedManager(record.author)).toBe(false);
    });

    it('returns without attaching when the source model has no relations declared', () => {
        const StandaloneModel = Model({
            namespace: 'test',
            name: 'Standalone',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });

        const record: Record<string, unknown> = { id: 5 };
        getExecutor(StandaloneModel.objects).attachPersistedRecordAccessors!(record, StandaloneModel.metadata.key);

        expect(record).toEqual({ id: 5 });
    });

    it('exposes the related manager to afterCreate, afterUpdate, beforeDelete, and afterBulkCreate hooks', async () => {
        const observedRecords: { hook: string; tagsIsManager: boolean }[] = [];
        const TagModel = Model({
            namespace: 'test',
            name: 'Tag',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                name: z.string(),
            }),
        });
        const PostModel = Model({
            namespace: 'test',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                title: z.string(),
                tags: t.manyToMany(TagModel),
            }),
            hooks: {
                afterCreate: ({ record }) => {
                    observedRecords.push({
                        hook: 'afterCreate',
                        tagsIsManager: ManyToManyRelatedManager.isManyToManyRelatedManager(
                            (record as Record<string, unknown>).tags
                        ),
                    });
                },
                afterUpdate: ({ record }) => {
                    observedRecords.push({
                        hook: 'afterUpdate',
                        tagsIsManager: ManyToManyRelatedManager.isManyToManyRelatedManager(
                            (record as Record<string, unknown>).tags
                        ),
                    });
                },
                beforeDelete: ({ current }) => {
                    observedRecords.push({
                        hook: 'beforeDelete',
                        tagsIsManager: ManyToManyRelatedManager.isManyToManyRelatedManager(
                            (current as Record<string, unknown>).tags
                        ),
                    });
                },
                afterBulkCreate: ({ records }) => {
                    observedRecords.push({
                        hook: 'afterBulkCreate',
                        tagsIsManager: records.every((record) =>
                            ManyToManyRelatedManager.isManyToManyRelatedManager(
                                (record as Record<string, unknown>).tags
                            )
                        ),
                    });
                },
            },
        });

        const client = await getTangoRuntime().getClient();
        await client.query('CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT)');

        await PostModel.objects.create({ id: 1, title: 'Hello' });
        await PostModel.objects.update(1, { title: 'Hello, world' });
        await PostModel.objects.bulkCreate([
            { id: 2, title: 'Two' },
            { id: 3, title: 'Three' },
        ]);
        await PostModel.objects.delete(1);

        expect(observedRecords).toEqual([
            { hook: 'afterCreate', tagsIsManager: true },
            { hook: 'afterUpdate', tagsIsManager: true },
            { hook: 'afterCreate', tagsIsManager: true },
            { hook: 'afterCreate', tagsIsManager: true },
            { hook: 'afterBulkCreate', tagsIsManager: true },
            { hook: 'beforeDelete', tagsIsManager: true },
        ]);
    });

    it('returns without attaching when the resolved related model lacks an objects manager', () => {
        const TagModel = Model({
            namespace: 'test',
            name: 'Tag',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });
        const PostModel = Model({
            namespace: 'test',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                tags: t.manyToMany(TagModel),
            }),
        });
        const registry = ModelRegistry.getOwner(PostModel);
        const fakeModel = { metadata: { key: 'test/Imposter' }, schema: { parse: () => ({}) } };
        const getByKeySpy = vi
            .spyOn(registry, 'getByKey')
            .mockReturnValue(fakeModel as unknown as ReturnType<typeof registry.getByKey>);

        const record: Record<string, unknown> = { id: 1 };
        try {
            getExecutor(PostModel.objects).attachPersistedRecordAccessors!(record, 'test/Imposter');
            expect(ManyToManyRelatedManager.isManyToManyRelatedManager(record.tags)).toBe(false);
        } finally {
            getByKeySpy.mockRestore();
        }
    });
});
