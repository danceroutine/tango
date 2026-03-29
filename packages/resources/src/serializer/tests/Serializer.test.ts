import { describe, expect, it } from 'vitest';
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

class UserSerializer extends Serializer<typeof createSchema, typeof updateSchema, typeof outputSchema> {
    static readonly createSchema = createSchema;
    static readonly updateSchema = updateSchema;
    static readonly outputSchema = outputSchema;
}

describe(Serializer, () => {
    it('exposes the serializer class and schemas', () => {
        const serializer = new UserSerializer();

        expect(serializer.getSerializerClass()).toBe(UserSerializer);
        expect(serializer.getCreateSchema()).toBe(createSchema);
        expect(serializer.getUpdateSchema()).toBe(updateSchema);
        expect(serializer.getOutputSchema()).toBe(outputSchema);
    });

    it('validates create and update input and output representation with zod', () => {
        const serializer = new UserSerializer();

        expect(serializer.deserializeCreate({ email: 'user@example.com' })).toEqual({ email: 'user@example.com' });
        expect(serializer.deserializeUpdate({ name: 'Updated' })).toEqual({ name: 'Updated' });
        expect(serializer.toRepresentation({ id: 1, email: 'user@example.com', name: 'User' })).toEqual({
            id: 1,
            email: 'user@example.com',
            name: 'User',
        });
    });
});
