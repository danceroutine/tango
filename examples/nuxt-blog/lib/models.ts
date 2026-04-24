import { z } from 'zod';
import { registerModelObjects } from '@danceroutine/tango-orm/runtime';
import { Model, t } from '@danceroutine/tango-schema';
import { slugify } from './slugify';

registerModelObjects();

export const UserReadSchema = z.object({
    id: z.number(),
    email: z.string().email(),
    username: z.string().min(3),
    createdAt: z.string(),
});

export const UserCreateSchema = z.object({
    email: z.string().email(),
    username: z.string().min(3),
});

export type User = z.output<typeof UserReadSchema>;

export const UserModel = Model({
    namespace: 'nuxt-blog',
    name: 'User',
    schema: UserReadSchema.extend({
        id: t.primaryKey(z.number().int()),
        email: t.unique(z.string().email()),
        username: t.unique(z.string().min(3)),
        createdAt: t.field(z.string()).defaultValue({ now: true }).build(),
    }),
});

export const TagReadSchema = z.object({
    id: z.number(),
    name: z.string().min(1).max(80),
    slug: z.string(),
    createdAt: z.string(),
});

export const TagCreateSchema = z.object({
    name: z.string().min(1).max(80),
    slug: z.string().optional(),
});

export type Tag = z.output<typeof TagReadSchema>;

export const TagModel = Model({
    namespace: 'nuxt-blog',
    name: 'Tag',
    schema: TagReadSchema.extend({
        id: t.primaryKey(z.number().int()),
        name: t.unique(z.string().min(1).max(80)),
        slug: t.unique(z.string()),
        createdAt: t.field(z.string()).defaultValue({ now: true }).build(),
    }),
    hooks: {
        async beforeCreate({ data }) {
            return {
                ...data,
                slug: data.slug ?? slugify(String(data.name)),
                createdAt: data.createdAt ?? new Date().toISOString(),
            };
        },
    },
});

export const PostRecordSchema = z.object({
    id: z.number(),
    title: z.string().min(1).max(200),
    slug: z.string(),
    content: z.string(),
    excerpt: z.string().nullable().optional(),
    authorId: z.number().nullable(),
    published: z.coerce.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

export const PostCreateSchema = z.object({
    title: z.string().min(1).max(200),
    slug: z.string().optional(),
    content: z.string().min(1),
    excerpt: z.string().optional(),
    authorId: z.number(),
    published: z.boolean().optional().default(false),
    tags: z.array(z.string().min(1)).optional().default([]),
});

export const PostTagSummarySchema = TagReadSchema.pick({
    id: true,
    name: true,
    slug: true,
});

export const PostReadSchema = PostRecordSchema.extend({
    tags: z.array(PostTagSummarySchema),
});

export type Post = z.output<typeof PostRecordSchema>;
export type PostResource = z.output<typeof PostReadSchema>;

export const PostModel = Model({
    namespace: 'nuxt-blog',
    name: 'Post',
    schema: PostRecordSchema.extend({
        id: t.primaryKey(z.number().int()),
        slug: t.unique(z.string()),
        authorId: t.foreignKey(t.modelRef<typeof UserModel>('nuxt-blog/User'), {
            field: z.number().int(),
            name: 'author',
            relatedName: 'posts',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
        }),
        tagIds: t.manyToMany(t.modelRef<typeof TagModel>('nuxt-blog/Tag'), {
            name: 'tags',
        }),
        published: t.field(z.coerce.boolean()).defaultValue('false').build(),
        createdAt: t.field(z.string()).defaultValue({ now: true }).build(),
        updatedAt: t.field(z.string()).defaultValue({ now: true }).build(),
    }),
    hooks: {
        async beforeCreate({ data }) {
            const now = new Date().toISOString();
            return {
                ...data,
                slug: data.slug ?? slugify(String(data.title)),
                createdAt: now,
                updatedAt: now,
            };
        },
        async beforeUpdate({ patch }) {
            return {
                ...patch,
                updatedAt: new Date().toISOString(),
            };
        },
    },
});

export const CommentReadSchema = z.object({
    id: z.number(),
    content: z.string().min(1),
    postId: z.number(),
    authorId: z.number(),
    createdAt: z.string(),
});

export const CommentCreateSchema = z.object({
    content: z.string().min(1),
    postId: z.number(),
    authorId: z.number(),
});

export type Comment = z.output<typeof CommentReadSchema>;

export const CommentModel = Model({
    namespace: 'nuxt-blog',
    name: 'Comment',
    schema: CommentReadSchema.extend({
        id: t.primaryKey(z.number().int()),
        postId: t.foreignKey(t.modelRef<typeof PostModel>('nuxt-blog/Post'), {
            field: z.number().int(),
            name: 'post',
            relatedName: 'comments',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
        }),
        authorId: t.foreignKey(t.modelRef<typeof UserModel>('nuxt-blog/User'), {
            field: z.number().int(),
            name: 'author',
            relatedName: 'comments',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
        }),
        createdAt: t.field(z.string()).defaultValue({ now: true }).build(),
    }),
});
