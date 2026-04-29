import { describe, expect, it } from 'vitest';
import { ManyToManyRelatedManager } from '@danceroutine/tango-orm';
import { aManyToManyRelatedManager } from '../aManyToManyRelatedManager';
import { aQueryExecutor } from '../aQueryExecutor';

describe(aManyToManyRelatedManager, () => {
    it('returns a branded ManyToManyRelatedManager with default owner bindings', () => {
        const { manager } = aManyToManyRelatedManager<{ id: number }>();
        expect(ManyToManyRelatedManager.isManyToManyRelatedManager(manager)).toBe(true);
    });

    it('exposes insertLink and deleteLink spies that record add/remove calls', async () => {
        const { manager, insertLink, deleteLink } = aManyToManyRelatedManager<{ id: number }>({
            ownerPrimaryKey: 10,
        });
        await manager.add(20);
        await manager.remove(21);
        expect(insertLink).toHaveBeenCalledWith(10, 20, { onDuplicate: 'ignore' });
        expect(deleteLink).toHaveBeenCalledWith(10, 21);
    });

    it('honors caller-supplied link behaviors and surfaces their resolved values', async () => {
        const captured: Array<{ owner: unknown; target: unknown }> = [];
        const { manager, insertLink } = aManyToManyRelatedManager<{ id: number }>({
            insertLink: async (owner, target) => {
                captured.push({ owner, target });
            },
        });

        await manager.add(99);

        expect(captured).toEqual([{ owner: 7, target: 99 }]);
        expect(insertLink).toHaveBeenCalledTimes(1);
    });

    it('honors caller-supplied batch link behaviors and custom atomic wrappers', async () => {
        const insertLinksCaptured: Array<{ owner: unknown; targets: readonly unknown[] }> = [];
        const deleteLinksCaptured: Array<{ owner: unknown; targets: readonly unknown[] }> = [];
        const atomicCalls: string[] = [];
        const { manager, insertLinks, deleteLinks, runAtomic } = aManyToManyRelatedManager<{ id: number }>({
            insertLinks: async (owner, targets) => {
                insertLinksCaptured.push({ owner, targets });
            },
            deleteLinks: async (owner, targets) => {
                deleteLinksCaptured.push({ owner, targets });
            },
            runAtomic: async (work) => {
                atomicCalls.push('begin');
                const result = await work();
                atomicCalls.push('commit');
                return result;
            },
        });

        await manager.add(1, 2);
        await manager.remove(3, 4);

        expect(insertLinksCaptured).toEqual([{ owner: 7, targets: [1, 2] }]);
        expect(deleteLinksCaptured).toEqual([{ owner: 7, targets: [3, 4] }]);
        expect(insertLinks).toHaveBeenCalledTimes(1);
        expect(deleteLinks).toHaveBeenCalledTimes(1);
        expect(runAtomic).toHaveBeenCalledTimes(2);
        expect(atomicCalls).toEqual(['begin', 'commit', 'begin', 'commit']);
    });

    it('uses the default batch link spies and atomic wrapper for multi-target operations', async () => {
        const { manager, insertLinks, deleteLinks, runAtomic } = aManyToManyRelatedManager<{ id: number }>();

        await manager.add(11, 12);
        await manager.remove(13, 14);

        expect(insertLinks).toHaveBeenCalledWith(7, [11, 12], { onDuplicate: 'ignore' });
        expect(deleteLinks).toHaveBeenCalledWith(7, [13, 14]);
        expect(runAtomic).toHaveBeenCalledTimes(2);
    });

    it('uses the default clear and createTarget spies when no overrides are supplied', async () => {
        const { manager, deleteAllLinksForOwner, createTarget } = aManyToManyRelatedManager<{
            id: number;
            name?: string;
        }>();

        await manager.clear();
        const created = await manager.create({ id: 99, name: 'tagged' });

        expect(deleteAllLinksForOwner).toHaveBeenCalledWith(7);
        expect(createTarget).toHaveBeenCalledWith({ id: 99, name: 'tagged' });
        expect(created).toEqual({ id: 99, name: 'tagged' });
    });

    it('routes all().fetch through the default selectTargetIdsForOwner spy when no override is supplied', async () => {
        const targetExecutor = aQueryExecutor<{ id: number }>({
            meta: { table: 'tags', pk: 'id', columns: { id: 'int' } },
        });
        const { manager, selectTargetIdsForOwner } = aManyToManyRelatedManager<{ id: number }>({
            targetExecutor,
        });

        const result = await manager.all().fetch();

        expect(result.results).toEqual([]);
        expect(selectTargetIdsForOwner).toHaveBeenCalledWith(7);
    });

    it('propagates a null target executor so callers can exercise the missing-executor path', () => {
        const { manager } = aManyToManyRelatedManager<{ id: number }>({ targetExecutor: null });
        expect(() => manager.all()).toThrow(/Cannot resolve a target query executor/);
    });

    it('returns a stub target executor when no override is supplied so all() does not throw on the provider', async () => {
        const { manager } = aManyToManyRelatedManager<{ id: number }>();
        manager.primePrefetchCache([{ id: 1 }]);
        const result = await manager.all().fetch();
        expect(result.results).toEqual([{ id: 1 }]);
    });
});
