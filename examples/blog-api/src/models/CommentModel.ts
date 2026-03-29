import { z } from 'zod';
import '@danceroutine/tango-orm/runtime';
import { Model, t } from '@danceroutine/tango-schema';
/**
 * Read schema for comments returned by manager and resource workflows.
 *
 * This schema is the output-side contract for comments. It fills the same
 * conceptual role as a serializer output shape in DRF: once a comment is loaded
 * and ready to leave the persistence layer, this is the structure callers see.
 */
export const CommentReadSchema = z.object({
    id: z.number(),
    content: z.string().min(1),
    postId: z.number(),
    authorId: z.number(),
    createdAt: z.string(),
});

/**
 * Input schema for comment creation.
 *
 * The create schema keeps the write contract explicit by focusing on the fields
 * a caller may provide when creating a comment. That keeps the create contract
 * narrow and makes the write-side API easy to inspect.
 */
export const CommentCreateSchema = z.object({
    content: z.string().min(1),
    postId: z.number(),
    authorId: z.number(),
});

/**
 * Input schema for partial comment updates.
 *
 * This schema narrows the update contract to the fields that may change during
 * a PATCH-style operation, which keeps write validation separate from the read
 * representation.
 */
export const CommentUpdateSchema = CommentCreateSchema.partial();

export type Comment = z.output<typeof CommentReadSchema>;

/**
 * Tango model definition for comments.
 *
 * The model is where Tango learns how comments relate to posts and users at the
 * database level. The foreign-key declarations are part of the schema contract
 * that migrations and introspection use to keep the database aligned with
 * application code.
 */
export const CommentModel = Model({
    namespace: 'blog',
    name: 'Comment',
    schema: CommentReadSchema.extend({
        id: t.primaryKey(z.number().int()),
        postId: t.foreignKey('blog/Post', z.number().int(), {
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
        }),
        authorId: t.foreignKey('blog/User', z.number().int(), {
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
        }),
        createdAt: t.default(z.string(), { now: true }),
    }),
});
