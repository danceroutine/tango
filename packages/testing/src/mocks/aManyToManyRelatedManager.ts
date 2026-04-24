import { vi } from 'vitest';
import type { QueryExecutor } from '@danceroutine/tango-orm';
import { ManyToManyRelatedManager } from '@danceroutine/tango-orm';

type ManagerConstructorInputs = ConstructorParameters<typeof ManyToManyRelatedManager>[0];

/**
 * Overrides accepted by the {@link aManyToManyRelatedManager} fixture. All
 * fields are optional; defaults produce a manager bound to owner primary key
 * `7`, relation name `'tags'`, owner label `'Post'`, and target primary-key
 * field `'id'`.
 */
export interface ManyToManyRelatedManagerFixtureOverrides<TTarget extends Record<string, unknown>> {
    ownerPrimaryKey?: unknown;
    relationName?: string;
    ownerModelLabel?: string;
    targetPrimaryKeyField?: string;
    /**
     * Resolver returned by the manager's `targetExecutorProvider`. Pass `null`
     * to simulate the registry not yet knowing about the target model; omit to
     * return a minimal executor stub.
     */
    targetExecutor?: QueryExecutor<TTarget> | null;
    insertLink?: (ownerPrimaryKey: unknown, targetPrimaryKey: unknown) => Promise<void>;
    insertLinks?: (ownerPrimaryKey: unknown, targetPrimaryKeys: readonly unknown[]) => Promise<void>;
    deleteLink?: (ownerPrimaryKey: unknown, targetPrimaryKey: unknown) => Promise<void>;
    deleteLinks?: (ownerPrimaryKey: unknown, targetPrimaryKeys: readonly unknown[]) => Promise<void>;
    deleteAllLinksForOwner?: (ownerPrimaryKey: unknown) => Promise<void>;
    selectTargetIdsForOwner?: (ownerPrimaryKey: unknown) => Promise<readonly (string | number)[]>;
    createTarget?: (input: Partial<TTarget>) => Promise<TTarget>;
    runAtomic?: <T>(work: () => Promise<T>) => Promise<T>;
}

/**
 * Return shape of the {@link aManyToManyRelatedManager} fixture. The spy
 * references are returned alongside the manager so tests can assert against
 * the join-table calls without reaching into private fields.
 */
export interface ManyToManyRelatedManagerFixture<TTarget extends Record<string, unknown>> {
    manager: ManyToManyRelatedManager<TTarget>;
    insertLink: ReturnType<typeof vi.fn>;
    insertLinks: ReturnType<typeof vi.fn>;
    deleteLink: ReturnType<typeof vi.fn>;
    deleteLinks: ReturnType<typeof vi.fn>;
    deleteAllLinksForOwner: ReturnType<typeof vi.fn>;
    selectTargetIdsForOwner: ReturnType<typeof vi.fn>;
    createTarget: ReturnType<typeof vi.fn>;
    runAtomic: ReturnType<typeof vi.fn>;
}

/**
 * Build a {@link ManyToManyRelatedManager} instance wired to lightweight spies
 * for its underlying join-table operations. The fixture skips the
 * relation-metadata and registry plumbing exercised by `ModelManager`, so
 * tests can focus on manager behavior in isolation.
 */
export function aManyToManyRelatedManager<TTarget extends Record<string, unknown>>(
    overrides: ManyToManyRelatedManagerFixtureOverrides<TTarget> = {}
): ManyToManyRelatedManagerFixture<TTarget> {
    const insertLink = vi.fn(overrides.insertLink ?? (async () => {}));
    const insertLinks = vi.fn(overrides.insertLinks ?? (async () => {}));
    const deleteLink = vi.fn(overrides.deleteLink ?? (async () => {}));
    const deleteLinks = vi.fn(overrides.deleteLinks ?? (async () => {}));
    const deleteAllLinksForOwner = vi.fn(overrides.deleteAllLinksForOwner ?? (async () => {}));
    const selectTargetIdsForOwner = vi.fn(
        overrides.selectTargetIdsForOwner ?? (async (): Promise<readonly (string | number)[]> => [])
    );
    const createTarget = vi.fn(
        overrides.createTarget ??
            (async (input: Partial<TTarget>) => {
                return input as TTarget;
            })
    );
    const runAtomicImpl: ManagerConstructorInputs['runAtomic'] =
        overrides.runAtomic ?? (async <T>(work: () => Promise<T>) => work());
    const runAtomicSpy = vi.fn(async <T>(work: () => Promise<T>) => runAtomicImpl(work));

    const throughTableManager = {
        insertLink,
        insertLinks,
        deleteLink,
        deleteLinks,
        deleteAllLinksForOwner,
        selectTargetIdsForOwner,
    } as unknown as ManagerConstructorInputs['throughTableManager'];

    const manager = new ManyToManyRelatedManager<TTarget>({
        ownerPrimaryKey: overrides.ownerPrimaryKey ?? 7,
        relationName: overrides.relationName ?? 'tags',
        ownerModelLabel: overrides.ownerModelLabel ?? 'Post',
        targetPrimaryKeyField: overrides.targetPrimaryKeyField ?? 'id',
        throughTableManager,
        targetExecutorProvider: () =>
            overrides.targetExecutor === undefined ? ({} as QueryExecutor<TTarget>) : overrides.targetExecutor,
        createTarget,
        runAtomic: runAtomicSpy as ManagerConstructorInputs['runAtomic'],
    });

    return {
        manager,
        insertLink,
        insertLinks,
        deleteLink,
        deleteLinks,
        deleteAllLinksForOwner,
        selectTargetIdsForOwner,
        createTarget,
        runAtomic: runAtomicSpy,
    };
}
