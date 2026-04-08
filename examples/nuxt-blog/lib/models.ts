import { z } from 'zod';
import { registerModelObjects } from '@danceroutine/tango-orm/runtime';
import { Model, t, type BeforeCreateHookArgs, type BeforeUpdateHookArgs } from '@danceroutine/tango-schema';
import { slugify } from '~~/lib/slugify';

// Nuxt/Nitro can tree-shake side-effect-only runtime imports from source-linked packages.
// Registering model objects here keeps `PostModel.objects` available in SSR pages and handlers.
registerModelObjects();

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

export const PostCreateSchema = z.object({
    title: z.string().min(1).max(200),
    slug: z.string().optional(),
    content: z.string().min(1),
    excerpt: z.string().optional(),
    published: z.boolean().optional().default(false),
});

export type Post = z.output<typeof PostReadSchema>;

export const PostModel = Model({
    namespace: 'nuxt-blog',
    name: 'Post',
    schema: PostReadSchema.extend({
        id: t.primaryKey(z.number().int()),
        slug: t.unique(z.string()),
        published: t.field(z.coerce.boolean()).defaultValue('false').build(),
        createdAt: t.field(z.string()).defaultValue({ now: true }).build(),
        updatedAt: t.field(z.string()).defaultValue({ now: true }).build(),
    }),
    hooks: {
        async beforeCreate({ data }: BeforeCreateHookArgs<Post>) {
            const now = new Date().toISOString();
            return {
                ...data,
                slug: data.slug ?? slugify(String(data.title)),
                createdAt: now,
                updatedAt: now,
            };
        },
        async beforeUpdate({ patch }: BeforeUpdateHookArgs<Post>) {
            return {
                ...patch,
                updatedAt: new Date().toISOString(),
            };
        },
    },
});
