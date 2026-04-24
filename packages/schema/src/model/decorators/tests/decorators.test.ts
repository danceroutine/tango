import { resetLoggerFactory, setLoggerFactory } from '@danceroutine/tango-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { t } from '../index';
import { Model } from '../../Model';
import { ModelRegistry } from '../../registry/index';

describe('model decorators', () => {
    beforeEach(() => {
        ModelRegistry.clear();
    });

    afterEach(() => {
        resetLoggerFactory();
    });

    it('resolves string foreign keys through registry', () => {
        Model({
            namespace: 'blog',
            name: 'User',
            table: 'users',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });

        const commentModel = Model({
            namespace: 'blog',
            name: 'Comment',
            table: 'comments',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                authorId: t.foreignKey('blog/User', { field: z.number().int() }),
            }),
        });

        const authorField = commentModel.metadata.fields.find((field) => field.name === 'authorId');
        expect(authorField?.references).toEqual({
            table: 'users',
            column: 'id',
            onDelete: undefined,
            onUpdate: undefined,
        });
    });

    it('supports direct model references in foreign keys', () => {
        const postModel = Model({
            namespace: 'blog',
            name: 'Post',
            table: 'posts',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });

        const commentModel = Model({
            namespace: 'blog',
            name: 'Comment',
            table: 'comments',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                postId: t.foreignKey(postModel, { field: z.number().int() }),
            }),
        });

        const postField = commentModel.metadata.fields.find((field) => field.name === 'postId');
        expect(postField?.references?.table).toBe('posts');
        expect(postField?.references?.column).toBe('id');
    });

    it('supports callback model references in foreign keys', () => {
        const userModel = Model({
            namespace: 'blog',
            name: 'User',
            table: 'users',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });

        const commentModel = Model({
            namespace: 'blog',
            name: 'Comment',
            table: 'comments',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                authorId: t.foreignKey(() => userModel, { field: z.number().int() }),
            }),
        });

        expect(commentModel.metadata.fields.find((field) => field.name === 'authorId')?.references?.table).toBe(
            'users'
        );
    });

    it('supports typed model references in foreign keys', () => {
        const userModel = Model({
            namespace: 'blog',
            name: 'User',
            table: 'users',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });

        const commentModel = Model({
            namespace: 'blog',
            name: 'Comment',
            table: 'comments',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                authorId: t.foreignKey(t.modelRef<typeof userModel>('blog/User'), {
                    field: z.number().int(),
                }),
            }),
        });
        // @ts-expect-error typed model refs must use the target model's literal key.
        void t.modelRef<typeof userModel>('blog/Post');

        expect(commentModel.metadata.fields.find((field) => field.name === 'authorId')?.references?.table).toBe(
            'users'
        );
    });

    it("falls back to 'id' when target model has no explicit primary key field", () => {
        const target = Model({
            namespace: 'blog',
            name: 'LegacyUser',
            table: 'legacy_users',
            schema: z.object({
                id: z.number().int(),
            }),
        });

        const commentModel = Model({
            namespace: 'blog',
            name: 'LegacyComment',
            table: 'legacy_comments',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                authorId: t.foreignKey(target, { field: z.number().int() }),
            }),
        });

        expect(commentModel.metadata.fields.find((field) => field.name === 'authorId')?.references?.column).toBe('id');
    });

    it('throws for unresolved string references', () => {
        const commentModel = Model({
            namespace: 'blog',
            name: 'Comment',
            table: 'comments',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                authorId: t.foreignKey('blog/User', { field: z.number().int() }),
            }),
        });

        expect(() => commentModel.metadata.fields).toThrow("Unable to resolve model reference 'blog/User'");
    });

    it('supports the object form for relation decorators', () => {
        Model({
            namespace: 'blog',
            name: 'User',
            table: 'users',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });

        const commentModel = Model({
            namespace: 'blog',
            name: 'Comment',
            table: 'comments',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                authorId: t.foreignKey('blog/User', {
                    field: z.number().int(),
                    column: 'legacy_id',
                    onDelete: 'CASCADE',
                    name: 'author',
                    relatedName: 'comments',
                }),
            }),
        });

        const authorField = commentModel.metadata.fields.find((field) => field.name === 'authorId');
        expect(authorField?.references).toEqual({
            table: 'users',
            column: 'legacy_id',
            onDelete: 'CASCADE',
            onUpdate: undefined,
        });
    });

    it('respects caller-provided field nullability in the canonical one-to-one object form', () => {
        Model({
            namespace: 'blog',
            name: 'User',
            table: 'users',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });

        const profileModel = Model({
            namespace: 'blog',
            name: 'Profile',
            table: 'profiles',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                userId: t.oneToOne('blog/User', {
                    field: z.number().int().optional(),
                    relatedName: 'profile',
                }),
            }),
        });

        expect(profileModel.metadata.fields.find((field) => field.name === 'userId')).toMatchObject({
            name: 'userId',
            notNull: false,
            unique: true,
        });
    });

    it('keeps default-schema behavior when the object second argument is omitted', () => {
        Model({
            namespace: 'blog',
            name: 'User',
            table: 'users',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });

        const commentModel = Model({
            namespace: 'blog',
            name: 'Comment',
            table: 'comments',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                authorId: t.foreignKey('blog/User'),
            }),
        });

        expect(commentModel.metadata.fields.find((field) => field.name === 'authorId')).toMatchObject({
            name: 'authorId',
            type: 'int',
            notNull: true,
        });
    });

    it('rejects relatedName on many-to-many decorators', () => {
        expect(() =>
            (t.manyToMany as unknown as (target: string, config: unknown) => unknown)('blog/Tag', {
                relatedName: 'posts',
            })
        ).toThrow('t.manyToMany(...) does not support relatedName yet.');
    });

    it('rejects partial through configuration on many-to-many decorators', () => {
        Model({
            namespace: 'blog',
            name: 'Tag',
            table: 'tags',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });
        const JoinModel = Model({
            namespace: 'blog',
            name: 'Join',
            table: 'joins',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });
        expect(() =>
            Model({
                namespace: 'blog',
                name: 'Post',
                table: 'posts',
                schema: z.object({
                    id: t.primaryKey(z.number().int()),
                    tags: t.manyToMany('blog/Tag', {
                        through: JoinModel,
                    }),
                }),
            })
        ).toThrow('through config requires through, throughSourceFieldName, and throughTargetFieldName.');
        expect(() =>
            Model({
                namespace: 'blog',
                name: 'OtherPost',
                table: 'other_posts',
                schema: z.object({
                    id: t.primaryKey(z.number().int()),
                    tags: t.manyToMany('blog/Tag', {
                        throughSourceFieldName: 'postId',
                        throughTargetFieldName: 'tagId',
                    }),
                }),
            })
        ).toThrow('through config requires through, throughSourceFieldName, and throughTargetFieldName.');
    });

    it('warns once per decorator kind for deprecated positional schema overloads', () => {
        const warn = vi.fn();
        setLoggerFactory({
            error: vi.fn(),
            warn,
            info: vi.fn(),
            debug: vi.fn(),
        });

        t.foreignKey('blog/User', z.number().int());
        t.foreignKey('blog/OtherUser', z.number().int());
        t.oneToOne('blog/Profile', z.number().int());
        t.oneToOne('blog/OtherProfile', z.number().int());
        t.manyToMany('blog/Tag', z.array(z.number().int()));
        t.manyToMany('blog/OtherTag', z.array(z.number().int()));

        expect(warn).toHaveBeenCalledTimes(3);
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('Deprecated positional schema overload used for t.foreignKey(...)')
        );
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('Deprecated positional schema overload used for t.oneToOne(...)')
        );
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('Deprecated positional schema overload used for t.manyToMany(...)')
        );
    });
});
