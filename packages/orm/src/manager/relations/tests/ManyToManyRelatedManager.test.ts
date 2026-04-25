import { describe, expect, it } from 'vitest';
import { aManyToManyRelatedManager, aQueryExecutor } from '@danceroutine/tango-testing';
import { ManyToManyRelatedManager } from '../ManyToManyRelatedManager';

describe(ManyToManyRelatedManager, () => {
    describe(ManyToManyRelatedManager.isManyToManyRelatedManager, () => {
        it('narrows branded instances', () => {
            const { manager } = aManyToManyRelatedManager();
            expect(ManyToManyRelatedManager.isManyToManyRelatedManager(manager)).toBe(true);
        });

        it('rejects plain objects and null', () => {
            expect(ManyToManyRelatedManager.isManyToManyRelatedManager({})).toBe(false);
            expect(ManyToManyRelatedManager.isManyToManyRelatedManager(null)).toBe(false);
        });
    });

    describe(ManyToManyRelatedManager.prototype.add, () => {
        it('forwards bare primary-key values directly to the through-table manager', async () => {
            const { manager, insertLink } = aManyToManyRelatedManager<{ id: number }>();
            await manager.add(11);
            expect(insertLink).toHaveBeenCalledWith(7, 11, { onDuplicate: 'ignore' });
        });

        it('extracts the configured primary-key field from object target references', async () => {
            const { manager, insertLink } = aManyToManyRelatedManager<{ id: number }>();
            await manager.add({ id: 21 });
            expect(insertLink).toHaveBeenCalledWith(7, 21, { onDuplicate: 'ignore' });
        });

        it('deduplicates multiple targets and runs the batch inside one atomic boundary', async () => {
            const { manager, insertLinks, runAtomic } = aManyToManyRelatedManager<{ id: number }>();
            await manager.add(11, { id: 12 }, 11, { id: 12 });
            expect(runAtomic).toHaveBeenCalledTimes(1);
            expect(insertLinks).toHaveBeenCalledWith(7, [11, 12], { onDuplicate: 'ignore' });
        });

        it('returns without mutating or invalidating the cache when no targets are supplied', async () => {
            const { manager, insertLink, insertLinks, runAtomic } = aManyToManyRelatedManager<{ id: number }>();
            manager.primePrefetchCache([{ id: 5 }]);
            await manager.add();
            expect(insertLink).not.toHaveBeenCalled();
            expect(insertLinks).not.toHaveBeenCalled();
            expect(runAtomic).not.toHaveBeenCalled();
            expect(manager.snapshotCache()).toEqual([{ id: 5 }]);
        });

        it('throws when the target object lacks the primary-key field value', async () => {
            const { manager } = aManyToManyRelatedManager<{ id: number }>({ targetPrimaryKeyField: 'id' });
            await expect(manager.add({} as unknown as { id: number })).rejects.toThrow(
                /Cannot resolve target primary key 'id' for relation 'tags' on 'Post'/
            );
        });

        it('deduplicates bigint, boolean, and object-backed carrier values independently', async () => {
            const { manager, insertLinks } = aManyToManyRelatedManager<{ id: number }>({
                targetPrimaryKeyField: 'id',
            });

            await manager.add(
                { id: 1n } as unknown as { id: number },
                { id: true } as unknown as { id: number },
                { id: { slug: 'tag-1' } } as unknown as { id: number },
                { id: 1n } as unknown as { id: number }
            );

            expect(insertLinks).toHaveBeenCalledWith(7, [1n, true, { slug: 'tag-1' }], { onDuplicate: 'ignore' });
        });

        it('throws when the target reference is neither a primary-key value nor a carrier object', async () => {
            const manager = new ManyToManyRelatedManager<{ id: number }>({
                ownerPrimaryKey: 7,
                relationName: 'tags',
                ownerModelLabel: 'Post',
                targetPrimaryKeyField: 'id',
                throughTableManager: {
                    insertLink: async () => {},
                    insertLinks: async () => {},
                    deleteLink: async () => {},
                    deleteLinks: async () => {},
                    deleteAllLinksForOwner: async () => {},
                    selectTargetIdsForOwner: async () => [],
                } as unknown as ConstructorParameters<typeof ManyToManyRelatedManager>[0]['throughTableManager'],
                targetExecutorProvider: () => null,
                createTarget: async () => ({ id: 1 } as { id: number }),
                runAtomic: async (work) => work(),
            });
            await expect(manager.add(true as unknown as { id: number })).rejects.toThrow(
                /Unsupported target reference for relation 'tags' on 'Post'/
            );
        });

        it('invalidates the prefetch cache after a successful add', async () => {
            const { manager } = aManyToManyRelatedManager<{ id: number }>();
            manager.primePrefetchCache([{ id: 5 }]);
            await manager.add(6);
            expect(manager.snapshotCache()).toBeNull();
        });
    });

    describe(ManyToManyRelatedManager.prototype.remove, () => {
        it('forwards bare primary-key values directly to the through-table manager', async () => {
            const { manager, deleteLink } = aManyToManyRelatedManager<{ id: number }>();
            await manager.remove('abc');
            expect(deleteLink).toHaveBeenCalledWith(7, 'abc');
        });

        it('extracts the configured primary-key field from object target references', async () => {
            const { manager, deleteLink } = aManyToManyRelatedManager<{ id: number }>();
            await manager.remove({ id: 22 });
            expect(deleteLink).toHaveBeenCalledWith(7, 22);
        });

        it('deduplicates multiple targets and runs the batch inside one atomic boundary', async () => {
            const { manager, deleteLinks, runAtomic } = aManyToManyRelatedManager<{ id: number }>();
            await manager.remove(22, { id: 23 }, 22, { id: 23 });
            expect(runAtomic).toHaveBeenCalledTimes(1);
            expect(deleteLinks).toHaveBeenCalledWith(7, [22, 23]);
        });

        it('throws when the target object carries a null primary-key value', async () => {
            const { manager } = aManyToManyRelatedManager<{ id: number }>({ targetPrimaryKeyField: 'id' });
            await expect(manager.remove({ id: null } as unknown as { id: number })).rejects.toThrow(
                /Cannot resolve target primary key 'id' for relation 'tags' on 'Post'/
            );
        });

        it('returns without mutating or invalidating the cache when no targets are supplied', async () => {
            const { manager, deleteLink, deleteLinks, runAtomic } = aManyToManyRelatedManager<{ id: number }>();
            manager.primePrefetchCache([{ id: 7 }]);
            await manager.remove();
            expect(deleteLink).not.toHaveBeenCalled();
            expect(deleteLinks).not.toHaveBeenCalled();
            expect(runAtomic).not.toHaveBeenCalled();
            expect(manager.snapshotCache()).toEqual([{ id: 7 }]);
        });

        it('invalidates the prefetch cache after a successful remove', async () => {
            const { manager } = aManyToManyRelatedManager<{ id: number }>();
            manager.primePrefetchCache([{ id: 7 }]);
            await manager.remove(7);
            expect(manager.snapshotCache()).toBeNull();
        });
    });

    describe(ManyToManyRelatedManager.prototype.clear, () => {
        it('deletes every link for the owning record', async () => {
            const { manager, deleteAllLinksForOwner, runAtomic } = aManyToManyRelatedManager<{ id: number }>();

            await manager.clear();

            expect(deleteAllLinksForOwner).toHaveBeenCalledWith(7);
            expect(runAtomic).not.toHaveBeenCalled();
        });

        it('invalidates the prefetch cache after a successful clear', async () => {
            const { manager } = aManyToManyRelatedManager<{ id: number }>();
            manager.primePrefetchCache([{ id: 7 }]);

            await manager.clear();

            expect(manager.snapshotCache()).toBeNull();
        });
    });

    describe(ManyToManyRelatedManager.prototype.create, () => {
        it('creates the target record and links it inside one atomic boundary', async () => {
            const events: string[] = [];
            const { manager, createTarget, insertLink, runAtomic } = aManyToManyRelatedManager<{
                id: number;
                name: string;
            }>({
                createTarget: async (input) => {
                    events.push(`create:${String(input.name)}`);
                    return { id: 23, name: String(input.name) };
                },
                insertLink: async (_ownerPrimaryKey, targetPrimaryKey) => {
                    events.push(`link:${String(targetPrimaryKey)}`);
                },
            });

            const created = await manager.create({ name: 'Featured' });

            expect(runAtomic).toHaveBeenCalledTimes(1);
            expect(createTarget).toHaveBeenCalledWith({ name: 'Featured' });
            expect(insertLink).toHaveBeenCalledWith(7, 23, { onDuplicate: 'ignore' });
            expect(created).toEqual({ id: 23, name: 'Featured' });
            expect(events).toEqual(['create:Featured', 'link:23']);
        });

        it('invalidates the prefetch cache after a successful create', async () => {
            const { manager } = aManyToManyRelatedManager<{ id: number }>({
                createTarget: async () => ({ id: 29 }),
            });
            manager.primePrefetchCache([{ id: 7 }]);

            await manager.create({});

            expect(manager.snapshotCache()).toBeNull();
        });

        it('preserves the cache when target creation fails', async () => {
            const { manager, insertLink } = aManyToManyRelatedManager<{ id: number }>({
                createTarget: async () => {
                    throw new Error('create failed');
                },
            });
            manager.primePrefetchCache([{ id: 7 }]);

            await expect(manager.create({})).rejects.toThrow('create failed');

            expect(insertLink).not.toHaveBeenCalled();
            expect(manager.snapshotCache()).toEqual([{ id: 7 }]);
        });

        it('throws when the created target record does not expose the configured primary key', async () => {
            const { manager, insertLink } = aManyToManyRelatedManager<{ id: number }>({
                targetPrimaryKeyField: 'id',
                createTarget: async () => ({ slug: 'missing-id' } as unknown as { id: number }),
            });

            await expect(manager.create({})).rejects.toThrow(
                /Cannot resolve target primary key 'id' for relation 'tags' on 'Post'/
            );

            expect(insertLink).not.toHaveBeenCalled();
        });
    });

    describe(ManyToManyRelatedManager.prototype.set, () => {
        it('replaces a non-empty relation set by removing missing links and adding new ones', async () => {
            const { manager, insertLink, insertLinks, deleteLink, deleteLinks, selectTargetIdsForOwner, runAtomic } =
                aManyToManyRelatedManager<{ id: number }>({
                    selectTargetIdsForOwner: async () => [11, 12],
                });
            manager.primePrefetchCache([{ id: 11 }, { id: 12 }]);

            await manager.set({ id: 12 }, { id: 13 });

            expect(selectTargetIdsForOwner).toHaveBeenCalledWith(7);
            expect(runAtomic).toHaveBeenCalledTimes(1);
            expect(deleteLink).toHaveBeenCalledWith(7, 11);
            expect(deleteLinks).not.toHaveBeenCalled();
            expect(insertLink).toHaveBeenCalledWith(7, 13, { onDuplicate: 'ignore' });
            expect(insertLinks).not.toHaveBeenCalled();
            expect(manager.snapshotCache()).toBeNull();
        });

        it('replaces the current relation set with an empty set when no targets are supplied', async () => {
            const { manager, deleteLink, deleteLinks, insertLink, insertLinks, runAtomic } = aManyToManyRelatedManager<{
                id: number;
            }>({
                selectTargetIdsForOwner: async () => [11, 12],
            });

            await manager.set();

            expect(runAtomic).toHaveBeenCalledTimes(1);
            expect(deleteLink).not.toHaveBeenCalled();
            expect(deleteLinks).toHaveBeenCalledWith(7, [11, 12]);
            expect(insertLink).not.toHaveBeenCalled();
            expect(insertLinks).not.toHaveBeenCalled();
        });

        it('deduplicates duplicate targets before diffing the replacement set', async () => {
            const { manager, insertLink, insertLinks, deleteLink, deleteLinks } = aManyToManyRelatedManager<{
                id: number;
            }>({
                selectTargetIdsForOwner: async () => [11],
            });

            await manager.set(11, { id: 12 }, 11, { id: 12 });

            expect(deleteLink).not.toHaveBeenCalled();
            expect(deleteLinks).not.toHaveBeenCalled();
            expect(insertLink).toHaveBeenCalledWith(7, 12, { onDuplicate: 'ignore' });
            expect(insertLinks).not.toHaveBeenCalled();
        });

        it('returns without mutating or invalidating the cache when the target set is unchanged', async () => {
            const { manager, insertLink, insertLinks, deleteLink, deleteLinks, runAtomic } = aManyToManyRelatedManager<{
                id: number;
            }>({
                selectTargetIdsForOwner: async () => [11, 12],
            });
            manager.primePrefetchCache([{ id: 11 }, { id: 12 }]);

            await manager.set(12, 11, 12);

            expect(deleteLink).not.toHaveBeenCalled();
            expect(deleteLinks).not.toHaveBeenCalled();
            expect(insertLink).not.toHaveBeenCalled();
            expect(insertLinks).not.toHaveBeenCalled();
            expect(runAtomic).not.toHaveBeenCalled();
            expect(manager.snapshotCache()).toEqual([{ id: 11 }, { id: 12 }]);
        });

        it('is idempotent across repeated calls with the same replacement set', async () => {
            let currentTargetPrimaryKeys: readonly number[] = [11];
            const { manager, insertLink, deleteLink, runAtomic } = aManyToManyRelatedManager<{ id: number }>({
                selectTargetIdsForOwner: async () => currentTargetPrimaryKeys,
                insertLink: async (_ownerPrimaryKey, targetPrimaryKey) => {
                    currentTargetPrimaryKeys = [...currentTargetPrimaryKeys, Number(targetPrimaryKey)];
                },
                deleteLink: async (_ownerPrimaryKey, targetPrimaryKey) => {
                    currentTargetPrimaryKeys = currentTargetPrimaryKeys.filter((id) => id !== Number(targetPrimaryKey));
                },
            });

            await manager.set(11, 12);
            await manager.set(12, 11);

            expect(insertLink).toHaveBeenCalledTimes(1);
            expect(deleteLink).not.toHaveBeenCalled();
            expect(runAtomic).toHaveBeenCalledTimes(1);
        });
    });

    describe(ManyToManyRelatedManager.prototype.all, () => {
        it('throws a descriptive error when the target executor cannot be resolved', () => {
            const { manager } = aManyToManyRelatedManager<{ id: number }>({ targetExecutor: null });
            expect(() => manager.all()).toThrow(/Cannot resolve a target query executor for relation 'tags' on 'Post'/);
        });

        it('short-circuits to the prefetch cache before reading the through table', async () => {
            const targetExecutor = aQueryExecutor<{ id: number }>({
                meta: { table: 'tags', pk: 'id', columns: { id: 'int' } },
            });
            const { manager, selectTargetIdsForOwner } = aManyToManyRelatedManager<{ id: number }>({
                targetExecutor,
                selectTargetIdsForOwner: async () => [42] as readonly (string | number)[],
            });
            manager.primePrefetchCache([{ id: 41 }]);

            const cached = await manager.all().fetch();
            expect(cached.results).toEqual([{ id: 41 }]);
            expect(selectTargetIdsForOwner).not.toHaveBeenCalled();
        });

        it('falls back to the through-table lookup after the cache is invalidated', async () => {
            const targetExecutor = aQueryExecutor<{ id: number }>({
                meta: { table: 'tags', pk: 'id', columns: { id: 'int' } },
            });
            const { manager, selectTargetIdsForOwner } = aManyToManyRelatedManager<{ id: number }>({
                targetExecutor,
                selectTargetIdsForOwner: async () => [42] as readonly (string | number)[],
            });
            manager.primePrefetchCache([{ id: 41 }]);
            manager.invalidateCache();

            const empty = await manager.all().fetch();
            expect(empty.results).toEqual([]);
            expect(selectTargetIdsForOwner).toHaveBeenCalledWith(7);
        });
    });

    describe(ManyToManyRelatedManager.prototype.primePrefetchCache, () => {
        it('exposes the primed values through snapshotCache', () => {
            const { manager } = aManyToManyRelatedManager<{ id: number }>();
            manager.primePrefetchCache([{ id: 5 }, { id: 6 }]);
            expect(manager.snapshotCache()).toEqual([{ id: 5 }, { id: 6 }]);
        });
    });

    describe(ManyToManyRelatedManager.prototype.snapshotCache, () => {
        it('returns null before any prefetch has been primed', () => {
            const { manager } = aManyToManyRelatedManager<{ id: number }>();
            expect(manager.snapshotCache()).toBeNull();
        });

        it('returns a copy that callers cannot use to mutate the manager', () => {
            const { manager } = aManyToManyRelatedManager<{ id: number }>();
            manager.primePrefetchCache([{ id: 5 }, { id: 6 }]);
            const snapshot = manager.snapshotCache() as { id: number }[];
            snapshot[0] = { id: 99 };
            expect(manager.snapshotCache()).toEqual([{ id: 5 }, { id: 6 }]);
        });
    });

    describe(ManyToManyRelatedManager.prototype.invalidateCache, () => {
        it('clears a previously primed cache back to null', () => {
            const { manager } = aManyToManyRelatedManager<{ id: number }>();
            manager.primePrefetchCache([{ id: 5 }]);
            manager.invalidateCache();
            expect(manager.snapshotCache()).toBeNull();
        });
    });
});
