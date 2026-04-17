import { z } from 'zod';
import '@danceroutine/tango-orm/runtime';
import { Model, t } from '@danceroutine/tango-schema';
import { slugify } from './slugify';

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
    namespace: 'nextjs-blog',
    name: 'User',
    schema: UserReadSchema.extend({
        id: t.primaryKey(z.number().int()),
        email: t.unique(z.string().email()),
        username: t.unique(z.string().min(3)),
        createdAt: t.field(z.string()).defaultValue({ now: true }).build(),
    }),
});

export const PostReadSchema = z.object({
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
});

export type Post = z.output<typeof PostReadSchema>;

export const PostModel = Model({
    namespace: 'nextjs-blog',
    name: 'Post',
    schema: PostReadSchema.extend({
        id: t.primaryKey(z.number().int()),
        slug: t.unique(z.string()),
        authorId: t.foreignKey(t.modelRef<typeof UserModel>('nextjs-blog/User'), {
            field: z.number().int(),
            name: 'author',
            relatedName: 'posts',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
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
    namespace: 'nextjs-blog',
    name: 'Comment',
    schema: CommentReadSchema.extend({
        id: t.primaryKey(z.number().int()),
        postId: t.foreignKey(t.modelRef<typeof PostModel>('nextjs-blog/Post'), {
            field: z.number().int(),
            name: 'post',
            relatedName: 'comments',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
        }),
        authorId: t.foreignKey(t.modelRef<typeof UserModel>('nextjs-blog/User'), {
            field: z.number().int(),
            name: 'author',
            relatedName: 'comments',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
        }),
        createdAt: t.field(z.string()).defaultValue({ now: true }).build(),
    }),
});
