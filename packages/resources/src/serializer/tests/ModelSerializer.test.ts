import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ModelSerializer } from '../ModelSerializer';
import { aManager } from '@danceroutine/tango-testing';
import type { ResourceModelLike } from '../../resource/index';

type UserRecord = {
    id: number;
    email: string;
    slug?: string;
};

const createSchema = z.object({
    email: z.string().email(),
});

const updateSchema = z.object({
    email: z.string().email().optional(),
});

const outputSchema = z.object({
    id: z.number(),
    email: z.string().email(),
    slug: z.string().optional(),
});

const model: ResourceModelLike<UserRecord> = {
    objects: aManager<UserRecord>({
        meta: { table: 'users', pk: 'id', columns: { id: 'int', email: 'text', slug: 'text' } },
        create: vi.fn(async (input) => ({ id: 1, ...input }) as UserRecord),
        update: vi.fn(async (id, patch) => ({ id: Number(id), email: 'existing@example.com', ...patch }) as UserRecord),
    }),
};

class UserSerializer extends ModelSerializer<
    UserRecord,
    typeof createSchema,
    typeof updateSchema,
    typeof outputSchema
> {
    static readonly model = model;
    static readonly createSchema = createSchema;
    static readonly updateSchema = updateSchema;
    static readonly outputSchema = outputSchema;

    protected override async beforeCreate(data: z.output<typeof createSchema>): Promise<Partial<UserRecord>> {
        return {
            ...data,
            slug: data.email.split('@')[0],
        };
    }

    protected override async beforeUpdate(
        _id: UserRecord[keyof UserRecord],
        data: z.output<typeof updateSchema>
    ): Promise<Partial<UserRecord>> {
        return {
            ...data,
            slug: 'updated-slug',
        };
    }
}

describe(ModelSerializer, () => {
    it('creates and updates through the model manager', async () => {
        const serializer = new UserSerializer();

        const created = await serializer.create({ email: 'user@example.com' });
        expect(created).toEqual({ id: 1, email: 'user@example.com', slug: 'user' });

        const updated = await serializer.update(1, { email: 'updated@example.com' });
        expect(updated).toEqual({ id: 1, email: 'updated@example.com', slug: 'updated-slug' });
    });

    it('requires a model when subclasses do not override getModel', () => {
        class MissingModelSerializer extends ModelSerializer<
            UserRecord,
            typeof createSchema,
            typeof updateSchema,
            typeof outputSchema
        > {
            static readonly createSchema = createSchema;
            static readonly updateSchema = updateSchema;
            static readonly outputSchema = outputSchema;
        }

        expect(() => new MissingModelSerializer().getModel()).toThrow(
            'MissingModelSerializer must define a static model or override getModel().'
        );
    });
});
