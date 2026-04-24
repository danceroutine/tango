import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Serializer } from '../Serializer';

const createSchema = z.object({
    email: z.string().email(),
});

const updateSchema = z.object({
    name: z.string().optional(),
});

const outputSchema = z.object({
    id: z.number(),
    email: z.string().email(),
    name: z.string().optional(),
});

const outputWithTagsSchema = outputSchema.extend({
    tags: z.array(z.string()),
});

type TaggedUserRecord = {
    id: number;
    email: string;
    name?: string;
    tags: {
        all(): Promise<readonly string[]>;
    };
};

class UserSerializer extends Serializer<typeof createSchema, typeof updateSchema, typeof outputSchema> {
    static readonly createSchema = createSchema;
    static readonly updateSchema = updateSchema;
    static readonly outputSchema = outputSchema;
}

class TaggedUserSerializer extends Serializer<
    typeof createSchema,
    typeof updateSchema,
    typeof outputWithTagsSchema,
    TaggedUserRecord
> {
    static readonly createSchema = createSchema;
    static readonly updateSchema = updateSchema;
    static readonly outputSchema = outputWithTagsSchema;
    static readonly outputResolvers = {
        tags: async (record: TaggedUserRecord) => record.tags.all(),
    };
}

describe(Serializer, () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('exposes the serializer class and schemas', () => {
        const serializer = new UserSerializer();

        expect(serializer.getSerializerClass()).toBe(UserSerializer);
        expect(serializer.getCreateSchema()).toBe(createSchema);
        expect(serializer.getUpdateSchema()).toBe(updateSchema);
        expect(serializer.getOutputSchema()).toBe(outputSchema);
    });

    it('validates create and update input and output representation with zod', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const serializer = new UserSerializer();

        expect(serializer.deserializeCreate({ email: 'user@example.com' })).toEqual({ email: 'user@example.com' });
        expect(serializer.deserializeUpdate({ name: 'Updated' })).toEqual({ name: 'Updated' });
        expect(serializer.toRepresentation({ id: 1, email: 'user@example.com', name: 'User' })).toEqual({
            id: 1,
            email: 'user@example.com',
            name: 'User',
        });
        expect(warn).toHaveBeenCalledWith(
            '[tango.resources.serializer]',
            '`Serializer.toRepresentation(...)` is deprecated. Use `serialize(...)` instead so output resolvers run before outward parsing.'
        );
        serializer.toRepresentation({ id: 1, email: 'user@example.com', name: 'User' });
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('resolves serializer-owned output fields through the async serialization path', async () => {
        const serializer = new TaggedUserSerializer();

        await expect(
            serializer.serialize({
                id: 1,
                email: 'user@example.com',
                name: 'User',
                tags: {
                    all: async () => ['staff'],
                },
            })
        ).resolves.toEqual({
            id: 1,
            email: 'user@example.com',
            name: 'User',
            tags: ['staff'],
        });
    });
});
