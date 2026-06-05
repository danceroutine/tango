import type { QueryExecutor } from '../QuerySet';
import type { CompiledHydrationNode, CompiledQuery } from '../domain/CompiledQuery';
import { InternalPrefetchQueryKind } from '../domain/internal/InternalPrefetchQueryKind';
import { InternalRelationHydrationCardinality } from '../domain/RelationTyping';
import { QueryCompiler } from '../compiler';
import { HydrationEntityRegistry } from './HydrationEntityRegistry';
import { createQueryRowNormalizerStrategy, type QueryRowNormalizerStrategy } from './QueryRowNormalizerStrategy';

/**
 * Coordinates compiled relation hydration for `QuerySet` evaluation.
 */
export class QueryHydrator<TModel extends Record<string, unknown>> {
    static readonly BRAND = 'tango.orm.query_hydrator' as const;
    readonly __tangoBrand: typeof QueryHydrator.BRAND = QueryHydrator.BRAND;

    private readonly normalizer: QueryRowNormalizerStrategy;

    constructor(
        private readonly executor: QueryExecutor<TModel>,
        normalizer?: QueryRowNormalizerStrategy
    ) {
        this.normalizer = normalizer ?? createQueryRowNormalizerStrategy(executor.adapter.dialect);
    }

    static isQueryHydrator(value: unknown): value is QueryHydrator<Record<string, unknown>> {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === QueryHydrator.BRAND
        );
    }

    async materializeRows(rows: readonly TModel[], compiled: CompiledQuery): Promise<Record<string, unknown>[]> {
        const hydratedRows = await this.hydrateRows(rows as unknown as Record<string, unknown>[], compiled);
        this.attachRootRecordAccessors(hydratedRows);
        return hydratedRows;
    }

    private async hydrateRows(
        rows: Record<string, unknown>[],
        compiled: CompiledQuery
    ): Promise<Record<string, unknown>[]> {
        if (!compiled.hydrationPlan) {
            return rows;
        }

        // Hydration mutates row objects by attaching related entities and
        // stripping internal alias columns. Copy once here so the executor's
        // raw rows remain untouched throughout the recursive hydration pass.
        const hydratedRows = rows.map((row) => ({ ...row }));
        this.attachRootRecordAccessors(hydratedRows);
        const registry = new HydrationEntityRegistry(this.executor.attachPersistedRecordAccessors);
        const queuedJoinPrefetchOwners = new Map<CompiledHydrationNode, Set<Record<string, unknown>>>();
        const compiler = new QueryCompiler(this.executor.meta, this.executor.adapter);

        for (const row of hydratedRows) {
            this.hydrateJoinNodesForOwner(
                row,
                row,
                compiled.hydrationPlan.joinNodes,
                registry,
                queuedJoinPrefetchOwners
            );
        }

        for (const node of compiled.hydrationPlan.prefetchNodes) {
            await this.hydratePrefetchNode(node, hydratedRows, registry, compiler);
        }

        for (const [node, owners] of queuedJoinPrefetchOwners.entries()) {
            await this.hydratePrefetchNode(node, [...owners], registry, compiler);
        }

        for (const row of hydratedRows) {
            for (const alias of compiled.hydrationPlan.hiddenRootAliases) {
                delete row[alias];
            }
        }

        return hydratedRows;
    }

    private attachRootRecordAccessors(rows: readonly Record<string, unknown>[]): void {
        if (!this.executor.attachPersistedRecordAccessors) {
            return;
        }
        const sourceModelKey = this.executor.meta.modelKey;
        for (const row of rows) {
            this.executor.attachPersistedRecordAccessors(row, sourceModelKey);
        }
    }

    private hydrateJoinNodesForOwner(
        owner: Record<string, unknown>,
        rawRow: Record<string, unknown>,
        nodes: readonly CompiledHydrationNode[],
        registry: HydrationEntityRegistry,
        queuedJoinPrefetchOwners?: Map<CompiledHydrationNode, Set<Record<string, unknown>>>
    ): void {
        // Join-backed descendants already live on the current SQL row. This
        // pass reads the aliased columns, materializes the related entity, and
        // then recurses into any join-backed children on the same row payload.
        for (const node of nodes) {
            if (!node.join) {
                continue;
            }

            const target: Record<string, unknown> = {};
            let hasTargetValue = false;

            for (const [column, alias] of Object.entries(node.join.columns)) {
                const value = rawRow[alias];
                delete rawRow[alias];
                target[column] = this.normalizer.normalizeColumnValue(node.targetColumns[column], value);
                if (value !== null && value !== undefined) {
                    hasTargetValue = true;
                }
            }

            if (!hasTargetValue) {
                owner[node.relationName] = null;
                continue;
            }

            const canonical = registry.canonicalize(node, target);
            owner[node.relationName] = canonical;
            for (const childNode of node.prefetchChildren) {
                const queuedOwners = queuedJoinPrefetchOwners?.get(childNode);
                if (queuedOwners) {
                    queuedOwners.add(canonical);
                    continue;
                }

                queuedJoinPrefetchOwners?.set(childNode, new Set([canonical]));
            }
            this.hydrateJoinNodesForOwner(canonical, rawRow, node.joinChildren, registry, queuedJoinPrefetchOwners);
        }
    }

    private async hydratePrefetchNode(
        node: CompiledHydrationNode,
        owners: readonly Record<string, unknown>[],
        registry: HydrationEntityRegistry,
        compiler: QueryCompiler
    ): Promise<void> {
        if (owners.length === 0) {
            return;
        }

        // Prefetch-backed descendants run as follow-up queries keyed by the
        // owner rows produced so far. Initialize defaults first so missing
        // children still hydrate to [] or null deterministically.
        const groupedOwners = this.groupOwnersByAccessor(owners, node.ownerSourceAccessor);
        const sourceValues = [...groupedOwners.keys()];
        const isManyToMany = !!node.throughTable;
        if (!isManyToMany) {
            for (const owner of owners) {
                owner[node.relationName] = node.cardinality === InternalRelationHydrationCardinality.MANY ? [] : null;
            }
        }

        if (sourceValues.length === 0) {
            return;
        }

        const sourceChunks = this.chunkValues(sourceValues, 500);
        const compiledPrefetch = compiler.compilePrefetch(node, sourceChunks[0]!);
        if (compiledPrefetch.kind === InternalPrefetchQueryKind.MANY_TO_MANY) {
            const idsByOwner = new Map<string | number, Array<string | number>>();
            const uniqueTargetIds = new Set<string | number>();

            for (const chunk of sourceChunks) {
                const chunkCompiled = compiler.compilePrefetch(node, chunk) as Extract<
                    typeof compiledPrefetch,
                    { kind: typeof InternalPrefetchQueryKind.MANY_TO_MANY }
                >;
                const throughResult = await this.executor.client.query<Record<string, unknown>>(
                    chunkCompiled.throughSql,
                    chunkCompiled.throughParams
                );

                for (const row of throughResult.rows) {
                    const ownerId = row[chunkCompiled.ownerAlias];
                    const targetId = row[chunkCompiled.targetAlias];
                    if (
                        (typeof ownerId !== 'string' && typeof ownerId !== 'number') ||
                        (typeof targetId !== 'string' && typeof targetId !== 'number')
                    ) {
                        continue;
                    }
                    const bucket = idsByOwner.get(ownerId) ?? [];
                    bucket.push(targetId);
                    idsByOwner.set(ownerId, bucket);
                    uniqueTargetIds.add(targetId);
                }
            }

            const targets: Record<string | number, Record<string, unknown>> = {};
            const targetIds = [...uniqueTargetIds.values()];
            if (targetIds.length > 0) {
                for (const targetChunk of this.chunkValues(targetIds, 500)) {
                    const targetQuery = compiler.compileManyToManyTargets(node, targetChunk);
                    const targetResult = await this.executor.client.query<Record<string, unknown>>(
                        targetQuery.sql,
                        targetQuery.params
                    );

                    for (const rawTargetRow of targetResult.rows) {
                        const normalized = this.normalizer.normalizeTargetRow(
                            rawTargetRow,
                            compiledPrefetch.targetColumns
                        );
                        const canonical = registry.canonicalize(node, normalized);
                        this.hydrateJoinNodesForOwner(canonical, normalized, node.joinChildren, registry);
                        const primaryKey = canonical[node.targetPrimaryKey];
                        if (typeof primaryKey === 'string' || typeof primaryKey === 'number') {
                            targets[primaryKey] = canonical;
                        }
                    }
                }
            }

            const canonicalChildren = new Map<string | number, Record<string, unknown>>();
            const handledOwners = new Set<Record<string, unknown>>();
            for (const [ownerId, ids] of idsByOwner.entries()) {
                const bucket = ids
                    .map((id) => targets[id])
                    .filter((value): value is Record<string, unknown> => !!value);
                for (const owner of groupedOwners.get(ownerId) ?? []) {
                    this.primeManyToManyOwnerCache(owner, node.relationName, bucket);
                    handledOwners.add(owner);
                }
                for (const child of bucket) {
                    canonicalChildren.set(child[node.targetPrimaryKey] as string | number, child);
                }
            }
            for (const owner of owners) {
                if (!handledOwners.has(owner)) {
                    this.primeManyToManyOwnerCache(owner, node.relationName, []);
                }
            }

            const childOwners = [...canonicalChildren.values()];
            for (const childNode of node.prefetchChildren) {
                await this.hydratePrefetchNode(childNode, childOwners, registry, compiler);
            }
            return;
        }

        const canonicalChildren = new Map<string | number, Record<string, unknown>>();
        for (const chunk of sourceChunks) {
            const chunkCompiled = compiler.compilePrefetch(node, chunk) as Extract<
                typeof compiledPrefetch,
                { kind: typeof InternalPrefetchQueryKind.DIRECT }
            >;
            const result = await this.executor.client.query<Record<string, unknown>>(
                chunkCompiled.sql,
                chunkCompiled.params
            );

            for (const rawResultRow of result.rows) {
                const normalized = this.normalizer.normalizeTargetRow(rawResultRow, chunkCompiled.targetColumns);
                const canonical = registry.canonicalize(node, normalized);
                this.hydrateJoinNodesForOwner(canonical, normalized, node.joinChildren, registry);

                const key = normalized[chunkCompiled.targetKey];
                if (typeof key !== 'string' && typeof key !== 'number') {
                    continue;
                }

                for (const owner of groupedOwners.get(key) ?? []) {
                    if (node.cardinality === InternalRelationHydrationCardinality.MANY) {
                        (owner[node.relationName] as Record<string, unknown>[]).push(canonical);
                    } else if (owner[node.relationName] === null) {
                        owner[node.relationName] = canonical;
                    }
                }

                const childPrimaryKey = canonical[node.targetPrimaryKey];
                if (typeof childPrimaryKey === 'string' || typeof childPrimaryKey === 'number') {
                    canonicalChildren.set(childPrimaryKey, canonical);
                }
            }
        }

        const childOwners = [...canonicalChildren.values()];
        for (const childNode of node.prefetchChildren) {
            await this.hydratePrefetchNode(childNode, childOwners, registry, compiler);
        }
    }

    private primeManyToManyOwnerCache(
        owner: Record<string, unknown>,
        relationName: string,
        bucket: readonly Record<string, unknown>[]
    ): void {
        const existing = owner[relationName];
        if (existing && typeof (existing as { primePrefetchCache?: unknown }).primePrefetchCache === 'function') {
            (existing as { primePrefetchCache: (rows: readonly Record<string, unknown>[]) => void }).primePrefetchCache(
                bucket
            );
            return;
        }
        owner[relationName] = bucket.slice();
    }

    private chunkValues<T>(values: readonly T[], size: number): T[][] {
        if (values.length <= size) {
            return [Array.from(values)];
        }
        const chunks: T[][] = [];
        for (let i = 0; i < values.length; i += size) {
            chunks.push(values.slice(i, i + size) as T[]);
        }
        return chunks;
    }

    private groupOwnersByAccessor(
        owners: readonly Record<string, unknown>[],
        accessor: string
    ): Map<string | number, Record<string, unknown>[]> {
        const grouped = new Map<string | number, Record<string, unknown>[]>();

        for (const owner of owners) {
            const key = owner[accessor];
            if (typeof key !== 'string' && typeof key !== 'number') {
                continue;
            }
            const bucket = grouped.get(key) ?? [];
            bucket.push(owner);
            grouped.set(key, bucket);
        }

        return grouped;
    }
}
