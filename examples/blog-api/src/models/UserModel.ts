import { z } from 'zod';
import '@danceroutine/tango-orm/runtime';
import { Model, t } from '@danceroutine/tango-schema';
/**
 * Read schema for users returned by the manager and resource layers.
 *
 * In Tango, a schema plays much of the same role that a DRF Serializer plays:
 * it defines the shape that application code accepts or returns at the edge of
 * a workflow. This schema is the "read" side of that contract, so it describes
 * what a caller can expect to receive after a user has already been loaded.
 */
export const UserReadSchema = z.object({
    id: z.number(),
    email: z.string().email(),
    username: z.string().min(3),
    createdAt: z.string(),
});

/**
 * Input schema for user creation.
 *
 * Keeping create input separate from the read schema makes the write contract
 * explicit. That mirrors the way many Django and DRF projects distinguish
 * between the fields a client may submit and the fields the server computes.
 */
export const UserCreateSchema = z.object({
    email: z.string().email(),
    username: z.string().min(3),
});

/**
 * Input schema for partial user updates.
 *
 * This is the PATCH-oriented companion to `UserCreateSchema`. It keeps the
 * update contract narrow and makes it obvious that callers are changing only a
 * subset of the persisted fields.
 */
export const UserUpdateSchema = UserCreateSchema.partial();

export type User = z.output<typeof UserReadSchema>;

/**
 * Tango model definition for users.
 *
 * `Model(...)` combines a Zod schema with persistence metadata such as primary
 * keys, uniqueness rules, and defaults. If you are coming from Django, this is
 * closest to the part of a Django model that describes the database-facing
 * structure, while the read and write schemas above play the serializer-like
 * role for API and application workflows.
 */
export const UserModel = Model({
    namespace: 'blog',
    name: 'User',
    schema: UserReadSchema.extend({
        id: t.primaryKey(z.number().int()),
        email: t.unique(z.string().email()),
        username: t.unique(z.string().min(3)),
        createdAt: t.default(z.string(), { now: true }),
    }),
});
