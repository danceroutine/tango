import { describe, expect, it } from 'vitest';
import { anAdapter, aDBClient } from '@danceroutine/tango-testing';
import { ThroughTableManager } from '../ThroughTableManager';
import { MutationCompiler } from '../../../internal/MutationCompiler';
import { OrmSqlSafetyAdapter } from '../../../../validation/OrmSqlSafetyAdapter';
import type { TableMeta } from '../../../../query/domain/index';
import type { Adapter } from '../../../../connection/adapters/Adapter';

const postgresAdapter = anAdapter({ dialect: 'postgres' });
const sqliteAdapter = anAdapter({ dialect: 'sqlite' });

const persistedRelation = {
    kind: 'manyToMany',
    table: 'tags',
    sourceKey: 'id',
    targetKey: 'id',
    targetPrimaryKey: 'id',
    targetColumns: { id: 'int' },
    alias: 'tag_tags',
    throughTable: 'm2m_post_tags',
    throughSourceKey: 'postId',
    throughTargetKey: 'tagId',
    throughModelKey: 'test/M2MPostTag',
} as unknown as NonNullable<TableMeta['relations']>[string];

const throughFields = [
    { name: 'id', type: 'int', primaryKey: true },
    { name: 'postId', type: 'int' },
    { name: 'tagId', type: 'int' },
];

describe(ThroughTableManager, () => {
    function buildHarness(
        queryImpl: (sql: string, params?: readonly unknown[]) => Promise<{ rows: unknown[] }> = async () => ({
            rows: [],
        })
    ) {
        const calls: Array<{ sql: string; params: readonly unknown[] | undefined }> = [];
        const client = aDBClient({
            query: async (sql, params) => {
                const result = await queryImpl(sql, params);
                calls.push({ sql, params });
                return result;
            },
        });
        return { client, calls };
    }

    it('builds itself from a relation edge and wires the supplied collaborators', () => {
        const { client } = buildHarness();
        const manager = ThroughTableManager.fromRelation({
            relation: persistedRelation,
            throughModelFields: throughFields,
            client,
            mutationCompiler: new MutationCompiler(postgresAdapter),
            adapter: postgresAdapter,
            sqlSafetyAdapter: new OrmSqlSafetyAdapter(),
        });
        expect(manager).toBeInstanceOf(ThroughTableManager);
    });

    it('compiles parameterized INSERT statements when linking owner to target', async () => {
        const { client, calls } = buildHarness();
        const manager = new ThroughTableManager(
            client,
            new MutationCompiler(postgresAdapter),
            ThroughTableManager.buildLinkDescriptor(persistedRelation, throughFields),
            postgresAdapter,
            new OrmSqlSafetyAdapter()
        );

        await manager.insertLink(1, 2);

        expect(calls).toEqual([
            {
                sql: 'INSERT INTO m2m_post_tags (postId, tagId) VALUES ($1, $2)',
                params: [1, 2],
            },
        ]);
    });

    it('compiles duplicate-safe bulk INSERT statements for postgres link writes', async () => {
        const { client, calls } = buildHarness();
        const manager = new ThroughTableManager(
            client,
            new MutationCompiler(postgresAdapter),
            ThroughTableManager.buildLinkDescriptor(persistedRelation, throughFields),
            postgresAdapter,
            new OrmSqlSafetyAdapter()
        );

        await manager.insertLinks(1, [2, 3], { onDuplicate: 'ignore' });

        expect(calls).toEqual([
            {
                sql: 'INSERT INTO m2m_post_tags (postId, tagId) VALUES ($1, $2), ($3, $4) ON CONFLICT (postId, tagId) DO NOTHING',
                params: [1, 2, 1, 3],
            },
        ]);
    });

    it('compiles duplicate-safe bulk INSERT statements for sqlite link writes', async () => {
        const { client, calls } = buildHarness();
        const manager = new ThroughTableManager(
            client,
            new MutationCompiler(sqliteAdapter),
            ThroughTableManager.buildLinkDescriptor(persistedRelation, throughFields),
            sqliteAdapter,
            new OrmSqlSafetyAdapter()
        );

        await manager.insertLinks(1, [2, 3], { onDuplicate: 'ignore' });

        expect(calls).toEqual([
            {
                sql: 'INSERT OR IGNORE INTO m2m_post_tags (postId, tagId) VALUES (?, ?), (?, ?)',
                params: [1, 2, 1, 3],
            },
        ]);
    });

    it('returns early for empty batch link mutations and rejects unsupported duplicate-safe adapters', async () => {
        const { client, calls } = buildHarness();
        const baseAdapter = anAdapter({ dialect: 'postgres' });
        const unsupportedAdapter: Adapter = {
            ...baseAdapter,
            features: {
                ...baseAdapter.features,
                ignoreDuplicateInsert: false,
            },
        };
        const manager = new ThroughTableManager(
            client,
            new MutationCompiler(unsupportedAdapter),
            ThroughTableManager.buildLinkDescriptor(persistedRelation, throughFields),
            unsupportedAdapter,
            new OrmSqlSafetyAdapter()
        );

        await manager.insertLinks(1, []);
        await manager.deleteLinks(1, []);
        expect(calls).toEqual([]);
        await expect(manager.insertLinks(1, [2], { onDuplicate: 'ignore' })).rejects.toThrow(
            /does not support duplicate-safe link insertion/i
        );
    });

    it('compiles parameterized DELETE statements when unlinking owner from target', async () => {
        const { client, calls } = buildHarness();
        const manager = new ThroughTableManager(
            client,
            new MutationCompiler(postgresAdapter),
            ThroughTableManager.buildLinkDescriptor(persistedRelation, throughFields),
            postgresAdapter
        );

        await manager.deleteLink(1, 2);

        expect(calls).toEqual([
            {
                sql: 'DELETE FROM m2m_post_tags WHERE postId = $1 AND tagId = $2',
                params: [1, 2],
            },
        ]);
    });

    it('compiles parameterized DELETE statements with IN clauses when unlinking several targets', async () => {
        const { client, calls } = buildHarness();
        const manager = new ThroughTableManager(
            client,
            new MutationCompiler(postgresAdapter),
            ThroughTableManager.buildLinkDescriptor(persistedRelation, throughFields),
            postgresAdapter
        );

        await manager.deleteLinks(1, [2, 3, 4]);

        expect(calls).toEqual([
            {
                sql: 'DELETE FROM m2m_post_tags WHERE postId = $1 AND tagId IN ($2, $3, $4)',
                params: [1, 2, 3, 4],
            },
        ]);
    });

    it('selects target ids linked to the supplied owner via the join table', async () => {
        const { client, calls } = buildHarness(async () => ({
            rows: [{ target_id: 10 }, { target_id: 11 }, { target_id: null }],
        }));
        const manager = new ThroughTableManager(
            client,
            new MutationCompiler(postgresAdapter),
            ThroughTableManager.buildLinkDescriptor(persistedRelation, throughFields),
            postgresAdapter
        );

        const ids = await manager.selectTargetIdsForOwner(7);

        expect(ids).toEqual([10, 11]);
        expect(calls).toEqual([
            {
                sql: 'SELECT tagId AS target_id FROM m2m_post_tags WHERE postId = $1',
                params: [7],
            },
        ]);
    });

    it('uses positional placeholders when the dialect is sqlite', async () => {
        const { client, calls } = buildHarness();
        const manager = new ThroughTableManager(
            client,
            new MutationCompiler(sqliteAdapter),
            ThroughTableManager.buildLinkDescriptor(persistedRelation, throughFields),
            sqliteAdapter
        );

        await manager.selectTargetIdsForOwner(3);

        expect(calls).toEqual([
            {
                sql: 'SELECT tagId AS target_id FROM m2m_post_tags WHERE postId = ?',
                params: [3],
            },
        ]);
    });
    describe(ThroughTableManager.buildLinkDescriptor, () => {
        it('derives the join-table descriptor from the through-model fields', () => {
            const descriptor = ThroughTableManager.buildLinkDescriptor(persistedRelation, throughFields);
            expect(descriptor).toEqual({
                table: 'm2m_post_tags',
                primaryKey: 'id',
                columns: { id: 'int', postId: 'int', tagId: 'int' },
                sourceColumn: 'postId',
                targetColumn: 'tagId',
            });
        });

        it('throws when the relation does not carry a persisted through-table edge', () => {
            const incompleteRelation = { ...persistedRelation, throughTable: undefined } as unknown as NonNullable<
                TableMeta['relations']
            >[string];
            expect(() => ThroughTableManager.buildLinkDescriptor(incompleteRelation, throughFields)).toThrow(
                /not a persisted many-to-many edge/
            );
        });

        it('throws when the through-model metadata is missing a primary-key field', () => {
            expect(() =>
                ThroughTableManager.buildLinkDescriptor(persistedRelation, [
                    { name: 'postId', type: 'int' },
                    { name: 'tagId', type: 'int' },
                ])
            ).toThrow(/missing a primary-key field/);
        });
    });
});
