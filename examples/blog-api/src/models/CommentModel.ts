import { z } from 'zod';
import '@danceroutine/tango-orm/runtime';
import { Model, t } from '@danceroutine/tango-schema';
import type { PostModel } from './PostModel';
import type { UserModel } from './UserModel';
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
        // `t.modelRef(...)` keeps the runtime relation decoupled through the stable model key while preserving TypeScript's target-model type.
        postId: t.foreignKey(t.modelRef<typeof PostModel>('blog/Post'), {
            // Stored foreign-key value for this comment's post.
            field: z.number().int(),
            // Forward relation exposed as Comment.post.
            name: 'post',
            // Reverse relation exposed as Post.comments.
            relatedName: 'comments',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
        }),
        // `t.modelRef(...)` keeps the runtime relation decoupled through the stable model key while preserving TypeScript's target-model type.
        authorId: t.foreignKey(t.modelRef<typeof UserModel>('blog/User'), {
            // Stored foreign-key value for this comment's author.
            field: z.number().int(),
            // Forward relation exposed as Comment.author.
            name: 'author',
            // Reverse relation exposed as User.comments.
            relatedName: 'comments',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
        }),
        createdAt: t.field(z.string()).defaultValue({ now: true }).build(),
    }),
});
