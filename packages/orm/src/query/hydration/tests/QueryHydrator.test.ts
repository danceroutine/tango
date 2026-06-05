import { describe, expect, it, vi } from 'vitest';
import { aQueryExecutor } from '@danceroutine/tango-testing';
import type { CompiledHydrationNode, CompiledQuery } from '../../domain/CompiledQuery';
import { InternalRelationHydrationLoadMode } from '../../domain/RelationMeta';
import { InternalRelationHydrationCardinality } from '../../domain/RelationTyping';
import type { TableMeta } from '../../domain/TableMeta';
import { QueryHydrator } from '../QueryHydrator';

const meta: TableMeta = {
    table: 'users',
    pk: 'id',
    columns: {
        id: 'int',
        email: 'text',
    },
};

function compiledWithHydration(hydrationPlan: NonNullable<CompiledQuery['hydrationPlan']>): CompiledQuery {
    return {
        sql: 'SELECT * FROM users',
        params: [],
        hydrationPlan,
    };
}

function prefetchNode(overrides: Partial<CompiledHydrationNode> = {}): CompiledHydrationNode {
    return {
        nodeId: 'profile',
        relationName: 'profile',
        relationPath: 'profile',
        ownerModelKey: 'tests/User',
        targetModelKey: 'tests/Profile',
        loadMode: InternalRelationHydrationLoadMode.PREFETCH,
        cardinality: InternalRelationHydrationCardinality.SINGLE,
        sourceKey: 'id',
        ownerSourceAccessor: 'id',
        targetKey: 'owner_id',
        targetTable: 'profiles',
        targetPrimaryKey: 'id',
        targetColumns: { id: 'int', owner_id: 'int', email: 'text' },
        provenance: ['profile'],
        joinChildren: [],
        prefetchChildren: [],
        ...overrides,
    };
}

describe(QueryHydrator, () => {
    it('materializes unhydrated rows and attaches root accessors', async () => {
        const attachPersistedRecordAccessors = vi.fn();
        const queryExecutor = aQueryExecutor<Record<string, unknown>>({
            meta,
            attachPersistedRecordAccessors,
        });
        const hydrator = new QueryHydrator(queryExecutor);

        const rows = await hydrator.materializeRows([{ id: 1, email: 'a@example.com' }], {
            sql: 'SELECT * FROM users',
            params: [],
        });

        expect(rows).toEqual([{ id: 1, email: 'a@example.com' }]);
        expect(attachPersistedRecordAccessors).toHaveBeenCalledWith(rows[0], undefined);
    });

    it('skips join nodes without compiled join descriptors', async () => {
        const queryExecutor = aQueryExecutor<Record<string, unknown>>({ meta });
        const hydrator = new QueryHydrator(queryExecutor);

        const rows = await hydrator.materializeRows(
            [{ id: 1, email: 'a@example.com' }],
            compiledWithHydration({
                requestedPaths: ['team'],
                hiddenRootAliases: [],
                joinNodes: [
                    prefetchNode({
                        nodeId: 'team',
                        relationName: 'team',
                        relationPath: 'team',
                        loadMode: InternalRelationHydrationLoadMode.JOIN,
                    }),
                ],
                prefetchNodes: [],
            })
        );

        expect(rows).toEqual([{ id: 1, email: 'a@example.com' }]);
    });

    it('no-ops empty prefetch owner batches', async () => {
        const query = vi.fn(async () => ({ rows: [] as Record<string, unknown>[] }));
        const queryExecutor = aQueryExecutor<Record<string, unknown>>({ meta, query });
        const hydrator = new QueryHydrator(queryExecutor);

        const rows = await hydrator.materializeRows(
            [],
            compiledWithHydration({
                requestedPaths: ['profile'],
                hiddenRootAliases: [],
                joinNodes: [],
                prefetchNodes: [prefetchNode()],
            })
        );

        expect(rows).toEqual([]);
        expect(query).not.toHaveBeenCalled();
    });

    it('hydrates a single-valued prefetch node with the first matching child', async () => {
        const query = vi.fn(async () => ({
            rows: [
                { id: 10, owner_id: 1, email: 'team@example.com' },
                { id: 11, owner_id: 1, email: 'other@example.com' },
                { id: null, owner_id: 1, email: 'ignored@example.com' },
            ],
        }));
        const queryExecutor = aQueryExecutor<Record<string, unknown>>({ meta, query });
        const hydrator = new QueryHydrator(queryExecutor);

        const rows = await hydrator.materializeRows(
            [{ id: 1, email: 'a@example.com' }],
            compiledWithHydration({
                requestedPaths: ['profile'],
                hiddenRootAliases: [],
                joinNodes: [],
                prefetchNodes: [prefetchNode()],
            })
        );

        expect(rows).toEqual([
            {
                id: 1,
                email: 'a@example.com',
                profile: { id: 10, owner_id: 1, email: 'team@example.com' },
            },
        ]);
    });

    it('chunks prefetch owner ids deterministically', async () => {
        const owners = Array.from({ length: 501 }, (_, index) => ({ id: index + 1 }));
        const query = vi.fn(async () => ({ rows: [] as Record<string, unknown>[] }));
        const queryExecutor = aQueryExecutor<Record<string, unknown>>({ meta, query });
        const hydrator = new QueryHydrator(queryExecutor);

        const rows = await hydrator.materializeRows(
            owners,
            compiledWithHydration({
                requestedPaths: ['posts'],
                hiddenRootAliases: [],
                joinNodes: [],
                prefetchNodes: [
                    prefetchNode({
                        nodeId: 'posts',
                        relationName: 'posts',
                        relationPath: 'posts',
                        cardinality: InternalRelationHydrationCardinality.MANY,
                        targetTable: 'posts',
                        targetPrimaryKey: 'id',
                        targetColumns: { id: 'int', owner_id: 'int' },
                    }),
                ],
            })
        );

        expect(rows[0]).toEqual({ id: 1, posts: [] });
        expect(rows.at(-1)).toEqual({ id: 501, posts: [] });
        expect(query).toHaveBeenCalledTimes(2);
    });

    it('narrows unknown values with a brand guard', () => {
        const queryExecutor = aQueryExecutor<Record<string, unknown>>({ meta });

        expect(QueryHydrator.isQueryHydrator(new QueryHydrator(queryExecutor))).toBe(true);
        expect(QueryHydrator.isQueryHydrator({})).toBe(false);
    });
});
