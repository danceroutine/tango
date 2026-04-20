import { describe, expect, it, vi } from 'vitest';
import { aManager } from '../aManager';
import { aQuerySet } from '../aQuerySet';

describe(aManager, () => {
    it('provides defaults and allows behavior overrides', async () => {
        const querySet = aQuerySet<{ id: number; name: string }>();
        const manager = aManager<{ id: number; name: string }>({
            querySet,
            create: async (input) => ({ id: 7, name: String(input.name ?? 'x') }),
            findById: async (id) => ({ id: Number(id), name: 'found' }),
        });

        expect(manager.meta.table).toBe('mock_table');
        expect(manager.query()).toBe(querySet);
        expect(manager.all()).toBe(querySet);
        await expect(manager.create({ name: 'created' })).resolves.toEqual({ id: 7, name: 'created' });
        await expect(manager.update('7', { name: 'updated' })).resolves.toEqual({ name: 'updated' });
        await expect(manager.findById('2')).resolves.toEqual({ id: 2, name: 'found' });
        await expect(manager.delete('2')).resolves.toBeUndefined();
        await expect(manager.bulkCreate([{ name: 'bulk' }])).resolves.toEqual([{ name: 'bulk' }]);
        await expect(manager.getOrCreate({ where: { id: 1 }, defaults: { name: 'created' } })).resolves.toEqual({
            record: { name: 'created' },
            created: true,
        });
        await expect(
            manager.updateOrCreate({ where: { id: 1 }, defaults: { name: 'created' }, update: { name: 'updated' } })
        ).resolves.toEqual({
            record: { name: 'created' },
            created: true,
            updated: false,
        });
    });

    it('supports explicit query and error-path overrides', async () => {
        const querySet = aQuerySet<{ id: number; name: string }>();
        const querySpy = vi.fn(() => querySet);
        const allSpy = vi.fn(() => querySet);
        const getOrThrowSpy = vi.fn(async () => ({ id: 5, name: 'found' }));
        const getOrCreateSpy = vi.fn(async () => ({ record: { id: 6, name: 'created' }, created: false }));
        const updateOrCreateSpy = vi.fn(async () => ({
            record: { id: 7, name: 'updated' },
            created: false,
            updated: true,
        }));
        const manager = aManager<{ id: number; name: string }>({
            query: querySpy,
            all: allSpy,
            getOrThrow: getOrThrowSpy,
            getOrCreate: getOrCreateSpy,
            updateOrCreate: updateOrCreateSpy,
        });

        expect(manager.query()).toBe(querySet);
        expect(manager.all()).toBe(querySet);
        await expect(manager.getOrThrow('5')).resolves.toEqual({ id: 5, name: 'found' });
        await expect(manager.getOrCreate({ where: { id: 6 } })).resolves.toEqual({
            record: { id: 6, name: 'created' },
            created: false,
        });
        await expect(manager.updateOrCreate({ where: { id: 7 }, update: { name: 'updated' } })).resolves.toEqual({
            record: { id: 7, name: 'updated' },
            created: false,
            updated: true,
        });
        expect(querySpy).toHaveBeenCalledTimes(1);
        expect(allSpy).toHaveBeenCalledTimes(1);
        expect(getOrThrowSpy).toHaveBeenCalledWith('5');
        expect(getOrCreateSpy).toHaveBeenCalledWith({ where: { id: 6 } });
        expect(updateOrCreateSpy).toHaveBeenCalledWith({ where: { id: 7 }, update: { name: 'updated' } });
    });

    it('throws from the default getOrThrow implementation when no record exists', async () => {
        const manager = aManager<{ id: number; name: string }>({
            meta: { table: 'users', pk: 'id', columns: { id: 'number', name: 'string' } },
        });

        await expect(manager.getOrThrow(9)).rejects.toThrow('No users record found for id=9.');
    });

    it('returns the found record from the default getOrThrow implementation', async () => {
        const manager = aManager<{ id: number; name: string }>({
            findById: async (id) => ({ id: Number(id), name: 'found' }),
        });

        await expect(manager.getOrThrow(3)).resolves.toEqual({ id: 3, name: 'found' });
    });

    it('uses override implementations for update, delete, and bulkCreate', async () => {
        const updateSpy = vi.fn(async (_id: number, patch: { name?: string }) => ({
            id: 2,
            name: patch.name ?? 'fallback',
        }));
        const deleteSpy = vi.fn(async (_id: number) => {});
        const bulkCreateSpy = vi.fn(async (inputs: Array<{ name: string }>) =>
            inputs.map((input, index) => ({ id: index + 1, ...input }))
        );
        const manager = aManager<{ id: number; name: string }>({
            update: updateSpy,
            delete: deleteSpy,
            bulkCreate: bulkCreateSpy,
        });

        await expect(manager.update(2, { name: 'updated' })).resolves.toEqual({
            id: 2,
            name: 'updated',
        });
        await expect(manager.delete(2)).resolves.toBeUndefined();
        await expect(manager.bulkCreate([{ name: 'one' }, { name: 'two' }])).resolves.toEqual([
            { id: 1, name: 'one' },
            { id: 2, name: 'two' },
        ]);
    });

    it('returns the input from the default create implementation', async () => {
        const manager = aManager<{ id: number; name: string }>();

        await expect(manager.create({ name: 'created' })).resolves.toEqual({ name: 'created' });
    });

    it('falls back to empty records for default getOrCreate and updateOrCreate calls without defaults', async () => {
        const manager = aManager<{ id: number; name: string }>();

        await expect(manager.getOrCreate({ where: { id: 1 } })).resolves.toEqual({
            record: {},
            created: true,
        });
        await expect(manager.updateOrCreate({ where: { id: 1 } })).resolves.toEqual({
            record: {},
            created: true,
            updated: false,
        });
    });
});
