import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { setupTestTangoRuntime } from '@danceroutine/tango-testing';
import { Model, ModelRegistry, t } from '@danceroutine/tango-schema';
import { ModelManager } from '../index';
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

    it('derives query relation metadata from the resolved relation graph and filters unsupported many-to-many edges', () => {
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
                id: z.number().int(),
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

        expect(PostModel.objects.meta.relations).toEqual({
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
        expect(PostModel.objects.meta.relations).not.toHaveProperty('tags');
        expect(UserModel.objects.meta.relations).toEqual({
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

        expect(PostModel.objects.meta.relations).toEqual({
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

        expect(UserModel.objects.meta.relations).toEqual({
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
});
