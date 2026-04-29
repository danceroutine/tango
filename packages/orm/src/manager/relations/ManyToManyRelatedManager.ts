import type { DBClient } from '../../connection/clients/DBClient';
import type { TableMeta } from '../../query/domain/index';
import type { Adapter } from '../../connection/adapters/Adapter';
import type { QueryExecutor, QuerySet } from '../../query/index';
import type { OrmSqlSafetyAdapter } from '../../validation/OrmSqlSafetyAdapter';
import type { MutationCompiler } from '../internal/MutationCompiler';
import { InternalDuplicateInsertPolicy } from '../internal/MutationCompiler';
import { ManyToManyRelatedQuerySet } from './ManyToManyRelatedQuerySet';
import { ThroughTableManager } from './internal/ThroughTableManager';

/**
 * Accepted target reference shapes for {@link ManyToManyRelatedManager.add},
 * {@link ManyToManyRelatedManager.remove}, and
 * {@link ManyToManyRelatedManager.set}.
 *
 * Application code may pass a target record, a primary-key carrier object, or
 * a bare primary-key value.
 *
 * @template TTarget - The persisted target record shape.
 */
export type ManyToManyTargetRef<TTarget extends Record<string, unknown>> =
    | TTarget
    | { readonly [pk: string]: unknown }
    | string
    | number;

/**
 * Inputs accepted by the {@link ManyToManyRelatedManager.create} factory. The
 * factory owns the wiring between relation metadata, the SQL safety adapter,
 * and the {@link ThroughTableManager}, so callers only supply context they
 * already have on hand.
 */
export interface ManyToManyRelatedManagerCreateInputs<TTarget extends Record<string, unknown>> {
    /** Persisted primary-key value of the owning record. */
    ownerPrimaryKey: unknown;
    /** Relation name on the owning model (for error messages). */
    relationName: string;
    /** Display name of the owning model (for error messages). */
    ownerModelLabel: string;
    /** Resolved relation edge metadata for the many-to-many relation. */
    relation: NonNullable<TableMeta['relations']>[string];
    /** Through-model column metadata used to derive the join-table descriptor. */
    throughModelFields: ReadonlyArray<{ name: string; type: string; primaryKey?: boolean }>;
    /** Runtime-bound database client shared with the owning manager. */
    client: DBClient;
    /** Shared {@link MutationCompiler} configured for the active dialect. */
    mutationCompiler: MutationCompiler;
    /** Active database adapter. Supplies placeholder formatting and dialect flags. */
    adapter: Adapter;
    /** SQL safety adapter shared with the owning manager. */
    sqlSafetyAdapter: OrmSqlSafetyAdapter;
    /** Lazy resolver returning the target model's {@link QueryExecutor}. */
    targetExecutorProvider: () => QueryExecutor<TTarget> | null;
    /** Model-manager-backed create path for new target records. */
    createTarget: (input: Partial<TTarget>) => Promise<TTarget>;
    /** Internal transaction runner used for multi-target membership writes. */
    runAtomic: <T>(work: () => Promise<T>) => Promise<T>;
}

interface ManyToManyRelatedManagerInternalInputs<TTarget extends Record<string, unknown>> {
    ownerPrimaryKey: unknown;
    relationName: string;
    ownerModelLabel: string;
    targetPrimaryKeyField: string;
    throughTableManager: ThroughTableManager;
    targetExecutorProvider: () => QueryExecutor<TTarget> | null;
    createTarget: (input: Partial<TTarget>) => Promise<TTarget>;
    runAtomic: <T>(work: () => Promise<T>) => Promise<T>;
}

/**
 * Django-style related manager exposed on materialized model records for each
 * many-to-many relation.
 *
 * Use the manager to add or remove join-table membership and to query the
 * related target rows. The owning record's primary key and the relation name
 * are bound when the manager is attached, so application code does not need
 * to pass them on every call.
 *
 * Prefetched memberships seed an internal cache that the queryset returned
 * from `all()` short-circuits to without re-querying. Mutations through
 * `add`, `remove`, `set`, `clear`, and `create` invalidate the cache so
 * subsequent reads observe the updated membership. `set(...)` applies
 * Django-shaped replacement semantics:
 * it diffs the current relation membership against the supplied targets,
 * removes any missing links, and inserts any new links inside one atomic
 * write boundary. `clear()` removes every join row for the owner, and
 * `create(...)` persists a new target row plus its join-row link inside one
 * atomic boundary.
 *
 * @template TTarget - The persisted target record shape returned by `all()`.
 */
export class ManyToManyRelatedManager<TTarget extends Record<string, unknown>> {
    private static readonly BRAND = 'tango.orm.m2m_related_manager' as const;
    readonly __tangoBrand: typeof ManyToManyRelatedManager.BRAND = ManyToManyRelatedManager.BRAND;

    private prefetchCache: readonly TTarget[] | null = null;

    /**
     * Constructor is internal. Application and ORM code must build instances
     * through {@link ManyToManyRelatedManager.create}, which owns the wiring
     * between relation metadata and the backing through-table mutator. The
     * testing package exposes a fixture for unit tests that need a custom
     * mutator.
     */
    constructor(private readonly inputs: ManyToManyRelatedManagerInternalInputs<TTarget>) {}

    /**
     * Narrow an unknown value to {@link ManyToManyRelatedManager}.
     */
    static isManyToManyRelatedManager<TTarget extends Record<string, unknown>>(
        value: unknown
    ): value is ManyToManyRelatedManager<TTarget> {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === ManyToManyRelatedManager.BRAND
        );
    }

    /**
     * Build a {@link ManyToManyRelatedManager} bound to a single owner record.
     * The factory derives the join-table descriptor from the relation edge and
     * through-model fields, wires a {@link ThroughTableManager} against the
     * supplied runtime-bound client, and returns a manager whose `add`,
     * `remove`, `clear`, `create`, and `all` methods enroll in any active
     * `transaction.atomic(...)` boundary.
     */
    static create<TTarget extends Record<string, unknown>>(
        inputs: ManyToManyRelatedManagerCreateInputs<TTarget>
    ): ManyToManyRelatedManager<TTarget> {
        const throughTableManager = ThroughTableManager.fromRelation({
            relation: inputs.relation,
            throughModelFields: inputs.throughModelFields,
            client: inputs.client,
            mutationCompiler: inputs.mutationCompiler,
            adapter: inputs.adapter,
            sqlSafetyAdapter: inputs.sqlSafetyAdapter,
        });
        return new ManyToManyRelatedManager<TTarget>({
            ownerPrimaryKey: inputs.ownerPrimaryKey,
            relationName: inputs.relationName,
            ownerModelLabel: inputs.ownerModelLabel,
            targetPrimaryKeyField: inputs.relation.targetPrimaryKey,
            throughTableManager,
            targetExecutorProvider: inputs.targetExecutorProvider,
            createTarget: inputs.createTarget,
            runAtomic: inputs.runAtomic,
        });
    }

    /**
     * Insert join-table rows linking the owning record to the supplied
     * targets. Duplicate links are ignored so repeated `add(...)` calls are
     * idempotent. When multiple targets are supplied, Tango performs the
     * membership write inside one `transaction.atomic(...)` boundary.
     */
    async add(...targets: ManyToManyTargetRef<TTarget>[]): Promise<void> {
        const targetPrimaryKeys = this.resolveTargetPrimaryKeys(targets);
        if (targetPrimaryKeys.length === 0) {
            return;
        }

        if (targetPrimaryKeys.length === 1) {
            await this.insertTargetPrimaryKeys(targetPrimaryKeys);
        } else {
            await this.inputs.runAtomic(() => this.insertTargetPrimaryKeys(targetPrimaryKeys));
        }
        this.invalidateCache();
    }

    /**
     * Delete join-table rows linking the owning record to the supplied
     * targets. When multiple targets are supplied, Tango performs the
     * membership write inside one `transaction.atomic(...)` boundary.
     */
    async remove(...targets: ManyToManyTargetRef<TTarget>[]): Promise<void> {
        const targetPrimaryKeys = this.resolveTargetPrimaryKeys(targets);
        if (targetPrimaryKeys.length === 0) {
            return;
        }

        if (targetPrimaryKeys.length === 1) {
            await this.deleteTargetPrimaryKeys(targetPrimaryKeys);
        } else {
            await this.inputs.runAtomic(() => this.deleteTargetPrimaryKeys(targetPrimaryKeys));
        }
        this.invalidateCache();
    }

    /**
     * Delete every join-table row linked to the owning record and invalidate
     * any prefetched membership cache after the delete succeeds.
     */
    async clear(): Promise<void> {
        await this.inputs.throughTableManager.deleteAllLinksForOwner(this.inputs.ownerPrimaryKey);
        this.invalidateCache();
    }

    /**
     * Create a new target record through the related model's manager and link
     * it to the owning record inside one `transaction.atomic(...)` boundary.
     * This preserves target-manager hooks and defaults while preventing a
     * created target row from leaking if the join-row insert fails.
     */
    async create(input: Partial<TTarget>): Promise<TTarget> {
        const created = await this.inputs.runAtomic(async () => {
            const target = await this.inputs.createTarget(input);
            const targetPrimaryKey = this.resolveTargetPrimaryKey(target);
            await this.insertTargetPrimaryKeys([targetPrimaryKey]);
            return target;
        });
        this.invalidateCache();
        return created;
    }

    /**
     * Replace the current relation membership with exactly the supplied
     * targets. Duplicate inputs are collapsed before diffing against the
     * current through-table rows, so repeated values do not trigger extra
     * writes. Calling `set()` with no targets clears the relation.
     *
     * When replacement requires writes, Tango performs the delete/insert
     * sequence inside one `transaction.atomic(...)` boundary.
     */
    async set(...targets: ManyToManyTargetRef<TTarget>[]): Promise<void> {
        const nextTargetPrimaryKeys = this.resolveTargetPrimaryKeys(targets);
        const currentTargetPrimaryKeys = await this.inputs.throughTableManager.selectTargetIdsForOwner(
            this.inputs.ownerPrimaryKey
        );
        const currentCanonical = new Set(
            currentTargetPrimaryKeys.map((primaryKey) => this.canonicalizePrimaryKey(primaryKey))
        );
        const nextCanonical = new Set(
            nextTargetPrimaryKeys.map((primaryKey) => this.canonicalizePrimaryKey(primaryKey))
        );
        const targetPrimaryKeysToRemove = currentTargetPrimaryKeys.filter(
            (primaryKey) => !nextCanonical.has(this.canonicalizePrimaryKey(primaryKey))
        );
        const targetPrimaryKeysToAdd = nextTargetPrimaryKeys.filter(
            (primaryKey) => !currentCanonical.has(this.canonicalizePrimaryKey(primaryKey))
        );

        if (targetPrimaryKeysToRemove.length === 0 && targetPrimaryKeysToAdd.length === 0) {
            return;
        }

        await this.inputs.runAtomic(async () => {
            await this.deleteTargetPrimaryKeys(targetPrimaryKeysToRemove);
            await this.insertTargetPrimaryKeys(targetPrimaryKeysToAdd);
        });
        this.invalidateCache();
    }

    /**
     * Return a {@link QuerySet} for the related target rows of this many-to-many
     * relation. When the relation was already loaded by `prefetchRelated(...)`,
     * the first `fetch()` resolves with the cached materialization without
     * re-querying. Mutating the membership through `add`/`remove`/`set`/
     * `clear`/`create` invalidates that cache.
     */
    all(): QuerySet<TTarget> {
        const executor = this.inputs.targetExecutorProvider();
        if (!executor) {
            throw new Error(
                `Cannot resolve a target query executor for relation '${this.inputs.relationName}' on '${this.inputs.ownerModelLabel}'.`
            );
        }
        return new ManyToManyRelatedQuerySet<TTarget>(executor, {
            getCache: () => this.prefetchCache,
            fetchTargetIds: () => this.inputs.throughTableManager.selectTargetIdsForOwner(this.inputs.ownerPrimaryKey),
            targetPrimaryKeyField: this.inputs.targetPrimaryKeyField,
        });
    }

    /**
     * Replace the prefetch cache with the supplied target rows. Called by the
     * many-to-many prefetch path so a follow-up `all()` resolves without an
     * extra database round-trip.
     */
    primePrefetchCache(targets: readonly TTarget[]): void {
        this.prefetchCache = [...targets];
    }

    /**
     * Drop any cached prefetch results. Mutating helpers call this so reads
     * after an `add`/`remove`/`set`/`clear`/`create` go back to the database.
     */
    invalidateCache(): void {
        this.prefetchCache = null;
    }

    /**
     * Snapshot of the current prefetch cache, exposed for diagnostics and
     * focused unit testing. Returns a fresh array copy so callers cannot
     * mutate the manager's internal state.
     */
    snapshotCache(): readonly TTarget[] | null {
        return this.prefetchCache ? [...this.prefetchCache] : null;
    }

    private async insertTargetPrimaryKeys(targetPrimaryKeys: readonly unknown[]): Promise<void> {
        if (targetPrimaryKeys.length === 0) {
            return;
        }
        if (targetPrimaryKeys.length === 1) {
            await this.inputs.throughTableManager.insertLink(this.inputs.ownerPrimaryKey, targetPrimaryKeys[0], {
                onDuplicate: InternalDuplicateInsertPolicy.IGNORE,
            });
            return;
        }
        await this.inputs.throughTableManager.insertLinks(this.inputs.ownerPrimaryKey, targetPrimaryKeys, {
            onDuplicate: InternalDuplicateInsertPolicy.IGNORE,
        });
    }

    private async deleteTargetPrimaryKeys(targetPrimaryKeys: readonly unknown[]): Promise<void> {
        if (targetPrimaryKeys.length === 0) {
            return;
        }
        if (targetPrimaryKeys.length === 1) {
            await this.inputs.throughTableManager.deleteLink(this.inputs.ownerPrimaryKey, targetPrimaryKeys[0]);
            return;
        }
        await this.inputs.throughTableManager.deleteLinks(this.inputs.ownerPrimaryKey, targetPrimaryKeys);
    }

    private resolveTargetPrimaryKeys(targets: readonly ManyToManyTargetRef<TTarget>[]): unknown[] {
        const resolved: unknown[] = [];
        const seen = new Set<string>();

        for (const target of targets) {
            const primaryKey = this.resolveTargetPrimaryKey(target);
            const canonical = this.canonicalizePrimaryKey(primaryKey);
            if (seen.has(canonical)) {
                continue;
            }
            seen.add(canonical);
            resolved.push(primaryKey);
        }

        return resolved;
    }

    private resolveTargetPrimaryKey(target: ManyToManyTargetRef<TTarget>): unknown {
        if (typeof target === 'string' || typeof target === 'number') {
            return target;
        }
        if (typeof target === 'object' && target !== null) {
            const targetPrimaryKey = (target as Record<string, unknown>)[this.inputs.targetPrimaryKeyField];
            if (targetPrimaryKey === undefined || targetPrimaryKey === null) {
                throw new Error(
                    `Cannot resolve target primary key '${this.inputs.targetPrimaryKeyField}' for relation '${this.inputs.relationName}' on '${this.inputs.ownerModelLabel}'.`
                );
            }
            return targetPrimaryKey;
        }
        throw new Error(
            `Unsupported target reference for relation '${this.inputs.relationName}' on '${this.inputs.ownerModelLabel}'. Expected a record, a primary-key carrier, or a primary-key value.`
        );
    }

    private canonicalizePrimaryKey(primaryKey: unknown): string {
        switch (typeof primaryKey) {
            case 'string':
                return `string:${primaryKey}`;
            case 'number':
                return `number:${primaryKey}`;
            case 'bigint':
                return `bigint:${String(primaryKey)}`;
            case 'boolean':
                return `boolean:${primaryKey}`;
            default:
                return `json:${JSON.stringify(primaryKey)}`;
        }
    }
}
