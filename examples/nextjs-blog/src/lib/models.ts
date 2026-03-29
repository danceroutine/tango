import { z } from 'zod';
import '@danceroutine/tango-orm/runtime';
import { Model, t } from '@danceroutine/tango-schema';
import { slugify } from '@/lib/slugify';

/**
 * Read schema for posts returned by both server-rendered pages and API routes.
 *
 * The page layer and the resource layer can both rely on the same outward-facing
 * shape, which keeps the example consistent across server rendering and HTTP.
 */
export const PostReadSchema = z.object({
    id: z.number(),
    title: z.string().min(1).max(200),
    slug: z.string(),
    content: z.string(),
    excerpt: z.string().nullable().optional(),
    published: z.coerce.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

/**
 * Input schema for creating posts through the API route.
 *
 * The serializer uses this contract for create validation, while the page layer
 * still benefits from the same shared definition when it needs post data types.
 */
export const PostCreateSchema = z.object({
    title: z.string().min(1).max(200),
    slug: z.string().optional(),
    content: z.string().min(1),
    excerpt: z.string().optional(),
    published: z.boolean().optional().default(false),
});

export type Post = z.output<typeof PostReadSchema>;

/**
 * Tango model definition for `posts`.
 *
 * The example's day-to-day application code talks to `PostModel.objects`.
 * The model remains the contract that migrations and other schema-aware tooling
 * rely on, while the serializer owns the HTTP-facing create, update, and output
 * workflow.
 */
export const PostModel = Model({
    namespace: 'nextjs-blog',
    name: 'Post',
    schema: PostReadSchema.extend({
        id: t.primaryKey(z.number().int()),
        slug: t.unique(z.string()),
        published: t.default(z.coerce.boolean(), 'false'),
        createdAt: t.default(z.string(), { now: true }),
        updatedAt: t.default(z.string(), { now: true }),
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
