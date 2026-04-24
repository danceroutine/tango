import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { setupTestTangoRuntime } from '@danceroutine/tango-testing';
import { Model, ModelRegistry, t } from '@danceroutine/tango-schema';
import { getTangoRuntime } from '../../runtime';
import { ManyToManyRelatedManager, ModelManager } from '../index';
import { registerModelObjects } from '../registerModelObjects';

describe(registerModelObjects, () => {
    beforeEach(async () => {
        ModelRegistry.clear();
        registerModelObjects();
        await setupTestTangoRuntime();
    });

    it('exposes a runtime-backed objects manager on plain Tango models', () => {
        const UserModel = Model({
            namespace: 'test',
            name: 'User',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                email: z.string().email(),
            }),
        });

        expect(ModelManager.isModelManager(UserModel.objects)).toBe(true);
        expect(UserModel.objects.meta).toEqual({
            table: 'users',
            pk: 'id',
            columns: {
                id: 'int',
                email: 'text',
            },
        });
    });

    it('is safe to call more than once', () => {
        expect(() => registerModelObjects()).not.toThrow();
    });

    it('derives query relation metadata from the resolved relation graph for field-authored relations', () => {
        const UserModel = Model({
            namespace: 'test',
            name: 'User',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
            relations: (r) => ({
                posts: r.hasMany('test/Post', 'authorId'),
            }),
        });

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
                authorId: t.foreignKey(UserModel, { field: z.number().int() }),
                tags: t.manyToMany(TagModel),
            }),
            relations: (r) => ({
                author: r.belongsTo('test/User', 'authorId'),
            }),
        });

        expect(PostModel.objects.meta.relations).toMatchObject({
            author: {
                kind: 'belongsTo',
                table: 'users',
                sourceKey: 'authorId',
                targetKey: 'id',
                targetColumns: {
                    id: 'int',
                },
                alias: 'user_author',
            },
        });
        expect(PostModel.objects.meta.relations).toMatchObject({
            tags: {
                kind: 'manyToMany',
                table: 'tags',
                sourceKey: 'id',
                targetKey: 'id',
                throughTable: expect.stringMatching(/^m2m_/),
                throughSourceKey: 'postId',
                throughTargetKey: 'tagId',
            },
        });
        expect(UserModel.objects.meta.relations).toMatchObject({
            posts: {
                kind: 'hasMany',
                table: 'posts',
                sourceKey: 'id',
                targetKey: 'authorId',
                targetColumns: {
                    id: 'int',
                    authorId: 'int',
                },
                alias: 'post_posts',
            },
        });
    });

    it('exposes many-to-many relations when a through model is provided', () => {
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
            }),
        });

        const PostTagModel = Model({
            namespace: 'test',
            name: 'PostTag',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                postId: t.foreignKey(PostModel, { field: z.number().int() }),
                tagId: t.foreignKey(TagModel, { field: z.number().int() }),
            }),
        });

        const PostWithTagsModel = Model({
            namespace: 'test',
            name: 'PostWithTags',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                tags: t.manyToMany(TagModel, {
                    name: 'tags',
                    through: PostTagModel,
                    throughSourceFieldName: 'postId',
                    throughTargetFieldName: 'tagId',
                }),
            }),
        });

        expect(PostWithTagsModel.objects.meta.relations).toMatchObject({
            tags: {
                kind: 'manyToMany',
                table: 'tags',
                sourceKey: 'id',
                targetKey: 'id',
                throughTable: 'post_tags',
                throughSourceKey: 'postId',
                throughTargetKey: 'tagId',
            },
        });
    });

    it('derives query relation metadata from field-authored relations when no explicit relations block is present', () => {
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
        });

        expect(PostModel.objects.meta.relations).toMatchObject({
            author: {
                kind: 'belongsTo',
                table: 'users',
                sourceKey: 'authorId',
                targetKey: 'id',
                targetColumns: {
                    id: 'int',
                },
                alias: 'user_author',
            },
        });
    });

    it('derives reverse one-to-one query relation metadata from field-authored relations', () => {
        const UserModel = Model({
            namespace: 'test',
            name: 'User',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });

        Model({
            namespace: 'test',
            name: 'Profile',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                userId: t.oneToOne(UserModel, {
                    field: z.number().int(),
                    relatedName: 'profile',
                }),
            }),
        });

        expect(UserModel.objects.meta.relations).toMatchObject({
            profile: {
                kind: 'hasOne',
                table: 'profiles',
                sourceKey: 'id',
                targetKey: 'userId',
                targetColumns: {
                    id: 'int',
                    userId: 'int',
                },
                alias: 'profile_profile',
            },
        });
    });

    it('derives the same alias shape from decorator names as from explicit relation overrides', () => {
        const UserModel = Model({
            namespace: 'test',
            name: 'User',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });

        const DecoratorNamedPostModel = Model({
            namespace: 'test',
            name: 'DecoratorNamedPost',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                authorId: t.foreignKey(UserModel, {
                    field: z.number().int(),
                    name: 'writer',
                }),
            }),
        });

        const ExplicitNamedPostModel = Model({
            namespace: 'test',
            name: 'ExplicitNamedPost',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                authorId: t.foreignKey(UserModel, { field: z.number().int() }),
            }),
            relations: (r) => ({
                writer: r.belongsTo('test/User', 'authorId'),
            }),
        });

        expect(DecoratorNamedPostModel.objects.meta.relations?.writer?.alias).toBe('user_writer');
        expect(ExplicitNamedPostModel.objects.meta.relations?.writer?.alias).toBe('user_writer');
    });

    it('rejects many-to-many related-manager creation when the relation does not persist a join row', () => {
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
        expect(() => PostModel.objects.createManyToManyRelatedManager('author', 1)).toThrow(
            /not a persisted many-to-many edge/
        );
    });

    it('resolves the target executor lazily so all() can issue follow-up queries against the target model', async () => {
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

        const tagsManager = PostModel.objects.createManyToManyRelatedManager<{ id: number }>('tags', 1);
        const spy = vi.spyOn(getTangoRuntime(), 'query').mockImplementation(async (sql: string) => {
            if (sql.startsWith('SELECT')) {
                if (/AS target_id/i.test(sql)) {
                    return { rows: [{ target_id: 7 }] } as never;
                }
                return { rows: [{ id: 7 }] } as never;
            }
            return { rows: [] } as never;
        });

        try {
            const result = await tagsManager.all().fetch();
            expect(result.results).toEqual([{ id: 7 }]);
        } finally {
            spy.mockRestore();
        }
    });

    it('throws from all() when the target model has no registered objects manager', () => {
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
        const tagsManager = PostModel.objects.createManyToManyRelatedManager<{ id: number }>('tags', 1);
        const registry = ModelRegistry.getOwner(PostModel);
        const fakeModel = { metadata: { key: TagModel.metadata.key }, schema: { parse: () => ({}) } };
        const getByKeySpy = vi
            .spyOn(registry, 'getByKey')
            .mockReturnValue(fakeModel as unknown as ReturnType<typeof registry.getByKey>);
        try {
            expect(() => tagsManager.all()).toThrow(/Cannot resolve a target query executor/);
        } finally {
            getByKeySpy.mockRestore();
        }
    });

    it('throws from create() when the target model has no registered objects manager', async () => {
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
        const tagsManager = PostModel.objects.createManyToManyRelatedManager<{ id: number }>('tags', 1);
        const registry = ModelRegistry.getOwner(PostModel);
        const fakeModel = { metadata: { key: TagModel.metadata.key }, schema: { parse: () => ({}) } };
        const getByKeySpy = vi
            .spyOn(registry, 'getByKey')
            .mockReturnValue(fakeModel as unknown as ReturnType<typeof registry.getByKey>);
        const runtime = getTangoRuntime();
        const client = {
            query: vi.fn(async (_sql: string, _params?: readonly unknown[]) => ({ rows: [] as never[] })),
            begin: vi.fn(async () => {}),
            commit: vi.fn(async () => {}),
            rollback: vi.fn(async () => {}),
            createSavepoint: vi.fn(async () => {}),
            releaseSavepoint: vi.fn(async () => {}),
            rollbackToSavepoint: vi.fn(async () => {}),
            close: vi.fn(async () => {}),
        };
        const release = vi.fn(async () => {});
        const leaseSpy = vi.spyOn(runtime, 'leaseTransactionClient').mockResolvedValue({ client, release });

        try {
            await expect(tagsManager.create({ id: 7 })).rejects.toThrow(/Cannot resolve a target manager/);
        } finally {
            leaseSpy.mockRestore();
            getByKeySpy.mockRestore();
        }
    });

    it('adds and removes many-to-many links for implicit join tables through the related manager', async () => {
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
        const manager = PostModel.objects;
        const tagsManager = manager.createManyToManyRelatedManager<{ id: number }>('tags', 1);
        expect(ManyToManyRelatedManager.isManyToManyRelatedManager(tagsManager)).toBe(true);

        const runtime = getTangoRuntime();
        const client = {
            query: vi.fn(async (_sql: string, _params?: readonly unknown[]) => ({ rows: [] as never[] })),
            begin: vi.fn(async () => {}),
            commit: vi.fn(async () => {}),
            rollback: vi.fn(async () => {}),
            createSavepoint: vi.fn(async () => {}),
            releaseSavepoint: vi.fn(async () => {}),
            rollbackToSavepoint: vi.fn(async () => {}),
            close: vi.fn(async () => {}),
        };
        const release = vi.fn(async () => {});
        const leaseSpy = vi.spyOn(runtime, 'leaseTransactionClient').mockResolvedValue({ client, release });
        try {
            await tagsManager.add({ id: 2 }, { id: 4 }, { id: 2 });
            await tagsManager.remove(3, 5, 3);
            expect(client.begin).toHaveBeenCalledTimes(2);
            expect(client.commit).toHaveBeenCalledTimes(2);
            expect(release).toHaveBeenCalledTimes(2);
            const batchedSql = client.query.mock.calls
                .map((call) => {
                    const head = typeof call[0] === 'string' ? call[0] : JSON.stringify(call[0]);
                    const tail = Array.isArray(call[1]) && call[1].length > 0 ? ` ${call[1].join(',')}` : '';
                    return `${head}${tail}`;
                })
                .join('\n');
            expect(batchedSql.toLowerCase()).toContain('insert');
            expect(/do nothing|or ignore/i.test(batchedSql)).toBe(true);
            expect(batchedSql.toLowerCase()).toContain('delete from');
            expect(batchedSql).toContain('1,2,1,4');
            expect(batchedSql).toContain('1,3,5');
        } finally {
            leaseSpy.mockRestore();
        }
    });

    it('creates, links, and clears many-to-many rows through the runtime-backed related manager', async () => {
        const tempDir = await mkdtemp(join(tmpdir(), 'tango-m2m-create-clear-'));

        try {
            await setupTestTangoRuntime({ sqliteFilename: join(tempDir, 'runtime.sqlite') });

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
            });

            const relation = PostModel.objects.meta.relations?.tags;
            expect(relation?.kind).toBe('manyToMany');
            expect(relation?.throughTable).toBeDefined();
            expect(relation?.throughSourceKey).toBeDefined();
            expect(relation?.throughTargetKey).toBeDefined();

            const client = await getTangoRuntime().getClient();
            await client.query('CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT)');
            await client.query('CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT)');
            await client.query(
                `CREATE TABLE ${relation!.throughTable} (
                    id INTEGER PRIMARY KEY,
                    ${relation!.throughSourceKey} INTEGER NOT NULL,
                    ${relation!.throughTargetKey} INTEGER NOT NULL,
                    UNIQUE (${relation!.throughSourceKey}, ${relation!.throughTargetKey})
                )`
            );

            const post = await PostModel.objects.create({ id: 1, title: 'Hello' });
            expect(ManyToManyRelatedManager.isManyToManyRelatedManager(post.tags)).toBe(true);

            post.tags.primePrefetchCache([{ id: 99, name: 'stale' }]);
            const created = await post.tags.create({ id: 2, name: 'tango' });

            expect(created).toEqual({ id: 2, name: 'tango' });
            expect(post.tags.snapshotCache()).toBeNull();

            const linked = await post.tags.all().orderBy('id').fetch();
            expect(linked.results).toEqual([{ id: 2, name: 'tango' }]);

            post.tags.primePrefetchCache([{ id: 2, name: 'tango' }]);
            await post.tags.clear();

            expect(post.tags.snapshotCache()).toBeNull();
            const remaining = await post.tags.all().fetch();
            expect(remaining.results).toEqual([]);
        } finally {
            await rm(tempDir, { recursive: true, force: true });
        }
    });

    it('rolls back the created target when the follow-up join insert fails', async () => {
        const tempDir = await mkdtemp(join(tmpdir(), 'tango-m2m-create-rollback-'));

        try {
            await setupTestTangoRuntime({ sqliteFilename: join(tempDir, 'runtime.sqlite') });

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
            });

            const client = await getTangoRuntime().getClient();
            await client.query('CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT)');
            await client.query('CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT)');

            const post = await PostModel.objects.create({ id: 1, title: 'Rollback' });

            await expect(post.tags.create({ id: 5, name: 'transient' })).rejects.toThrow();

            const tags = await TagModel.objects.all().fetch();
            expect(tags.results).toEqual([]);
        } finally {
            await rm(tempDir, { recursive: true, force: true });
        }
    });
});
