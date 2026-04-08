import { z } from 'zod';
import '@danceroutine/tango-orm/runtime';
import { Model, t } from '@danceroutine/tango-schema';
import type { UserModel } from './UserModel';
/**
 * Read schema for posts returned by manager and resource workflows.
 *
 * This is the serializer-like output contract for posts. It tells the rest of
 * the application what a fully loaded post looks like after persistence and
 * validation concerns have already been handled.
 */
export const PostReadSchema = z.object({
    id: z.number(),
    title: z.string().min(1),
    content: z.string().min(1),
    authorId: z.number(),
    published: z.coerce.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

/**
 * Input schema for post creation.
 *
 * The create schema describes what a caller may submit when creating a post.
 * It intentionally excludes values such as database-managed timestamps, which
 * helps keep write-side behavior explicit and easy to reason about.
 */
export const PostCreateSchema = z.object({
    title: z.string().min(1),
    content: z.string().min(1),
    authorId: z.number(),
    published: z.boolean().optional().default(false),
});

/**
 * Input schema for partial post updates.
 *
 * This schema models the PATCH-style write contract for posts. Keeping it
 * separate from the read schema mirrors the way DRF serializers often separate
 * output representation from update validation.
 */
export const PostUpdateSchema = PostCreateSchema.partial().extend({
    updatedAt: z.string().optional(),
});

export type Post = z.output<typeof PostReadSchema>;

/**
 * Tango model definition for posts.
 *
 * `Model(...)` is where the example expresses database-facing structure such as
 * the primary key, the foreign key to users, and default values. The schema and
 * metadata together give Tango enough information to drive migrations and other
 * schema-aware tooling from one declared model contract.
 */
export const PostModel = Model({
    namespace: 'blog',
    name: 'Post',
    schema: PostReadSchema.extend({
        id: t.primaryKey(z.number().int()),
        // `t.modelRef(...)` keeps the runtime relation decoupled through the stable model key while preserving TypeScript's target-model type.
        authorId: t.foreignKey(t.modelRef<typeof UserModel>('blog/User'), {
            // Stored foreign-key value for this post.
            field: z.number().int(),
            // Forward relation exposed as Post.author.
            name: 'author',
            // Reverse relation exposed as User.posts.
            relatedName: 'posts',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
        }),
        published: t.field(z.coerce.boolean()).defaultValue('false').build(),
        createdAt: t.field(z.string()).defaultValue({ now: true }).build(),
        updatedAt: t.field(z.string()).defaultValue({ now: true }).build(),
    }),
    hooks: {
        async beforeUpdate({ patch }) {
            return {
                ...patch,
                updatedAt: new Date().toISOString(),
            };
        },
    },
});
