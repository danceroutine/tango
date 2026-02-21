import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Model, ModelRegistry, t } from '../index';

describe('model decorators', () => {
    beforeEach(() => {
        ModelRegistry.clear();
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
                authorId: t.foreignKey('blog/User', z.number().int()),
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
                postId: t.foreignKey(postModel, z.number().int()),
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
                authorId: t.foreignKey(() => userModel, z.number().int()),
            }),
        });

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
                authorId: t.foreignKey(target, z.number().int()),
            }),
        });

        expect(commentModel.metadata.fields.find((field) => field.name === 'authorId')?.references?.column).toBe('id');
    });

    it('throws for unresolved string references', () => {
        expect(() => {
            Model({
                namespace: 'blog',
                name: 'Comment',
                table: 'comments',
                schema: z.object({
                    id: t.primaryKey(z.number().int()),
                    authorId: t.foreignKey('blog/User', z.number().int()),
                }),
            });
        }).toThrow("Unable to resolve model reference 'blog/User'");
    });
});
