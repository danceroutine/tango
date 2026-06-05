import { describe, expect, it } from 'vitest';
import { anAdapter } from '@danceroutine/tango-testing';
import { PrefetchQueryCompiler } from '../PrefetchQueryCompiler';
import type { CompiledHydrationNode } from '../../domain/CompiledQuery';
import { InternalPrefetchQueryKind } from '../../domain/internal/InternalPrefetchQueryKind';
import type { TableMeta } from '../../domain/TableMeta';

const mockMeta: TableMeta = {
    table: 'users',
    pk: 'id',
    columns: {
        id: 'int',
        organization_id: 'int',
        email: 'text',
        name: 'text',
        age: 'int',
        isActive: 'bool',
    },
};

const postgresAdapter = anAdapter({ dialect: 'postgres' });
const sqliteAdapter = anAdapter({ dialect: 'sqlite' });

function compiledPrefetchNode(overrides: Partial<CompiledHydrationNode> = {}): CompiledHydrationNode {
    return {
        nodeId: 'posts',
        relationName: 'posts',
        relationPath: 'posts',
        ownerModelKey: 'tests/User',
        targetModelKey: 'tests/Post',
        loadMode: 'prefetch',
        cardinality: 'many',
        sourceKey: 'id',
        ownerSourceAccessor: 'id',
        targetKey: 'author_id',
        targetTable: 'posts',
        targetPrimaryKey: 'id',
        targetColumns: { id: 'int', author_id: 'int', title: 'text' },
        provenance: ['posts'],
        joinChildren: [],
        prefetchChildren: [],
        ...overrides,
    };
}

describe(PrefetchQueryCompiler, () => {
    it('compiles validated direct prefetch follow-up queries', () => {
        const compiler = new PrefetchQueryCompiler(mockMeta, postgresAdapter);

        expect(compiler.compilePrefetch(compiledPrefetchNode(), [1, 2])).toEqual({
            kind: InternalPrefetchQueryKind.DIRECT,
            sql: 'SELECT __tango_prefetch_base_posts.id AS id, __tango_prefetch_base_posts.author_id AS author_id, __tango_prefetch_base_posts.title AS title FROM posts __tango_prefetch_base_posts WHERE __tango_prefetch_base_posts.author_id IN ($1, $2) ORDER BY __tango_prefetch_base_posts.author_id ASC, __tango_prefetch_base_posts.id ASC',
            params: [1, 2],
            targetKey: 'author_id',
            targetColumns: { id: 'int', author_id: 'int', title: 'text' },
        });
    });

    it('splits many-to-many prefetch into a through-table read and target primary-key read', () => {
        const compiler = new PrefetchQueryCompiler(mockMeta, postgresAdapter);
        const compiled = compiler.compilePrefetch(
            compiledPrefetchNode({
                targetTable: 'tags',
                targetPrimaryKey: 'id',
                targetColumns: { id: 'int', name: 'text' },
                throughTable: 'post_tags',
                throughSourceKey: 'post_id',
                throughTargetKey: 'tag_id',
            }),
            [1, 2]
        );

        expect(compiled.kind).toBe(InternalPrefetchQueryKind.MANY_TO_MANY);
        if (compiled.kind !== InternalPrefetchQueryKind.MANY_TO_MANY) {
            throw new Error('Expected many-to-many compilation');
        }
        expect(compiled.throughSql).toContain('FROM post_tags');
        expect(compiled.throughSql).toContain('ORDER BY post_tags.post_id ASC');

        const targets = compiler.compileManyToManyTargets(
            compiledPrefetchNode({
                targetTable: compiled.targetTable,
                targetPrimaryKey: compiled.targetPrimaryKey,
                targetColumns: compiled.targetColumns,
                targetKey: compiled.targetPrimaryKey,
            }),
            [10, 11]
        );
        expect(targets.sql).toContain('FROM tags');
        expect(targets.sql).toContain('WHERE __tango_prefetch_base_posts.id IN ($1, $2)');
    });

    describe.each([
        { dialect: 'postgres' as const, adapter: postgresAdapter, expectedPlaceholders: 'IN ($1, $2)' },
        { dialect: 'sqlite' as const, adapter: sqliteAdapter, expectedPlaceholders: 'IN (?, ?)' },
    ])('uses $dialect placeholders for many-to-many prefetch queries', ({ adapter, expectedPlaceholders }) => {
        it('scopes the through-table read to owner ids', () => {
            const compiler = new PrefetchQueryCompiler(mockMeta, adapter);
            const compiled = compiler.compilePrefetch(
                compiledPrefetchNode({
                    targetTable: 'tags',
                    targetPrimaryKey: 'id',
                    targetColumns: { id: 'int', name: 'text' },
                    throughTable: 'post_tags',
                    throughSourceKey: 'post_id',
                    throughTargetKey: 'tag_id',
                }),
                [1, 2]
            );

            expect(compiled.kind).toBe(InternalPrefetchQueryKind.MANY_TO_MANY);
            if (compiled.kind !== InternalPrefetchQueryKind.MANY_TO_MANY) {
                throw new Error('Expected many-to-many compilation');
            }
            expect(compiled.throughSql).toContain(expectedPlaceholders);
        });

        it('scopes the follow-up target read to resolved target ids', () => {
            const compiler = new PrefetchQueryCompiler(mockMeta, adapter);
            const targets = compiler.compileManyToManyTargets(
                compiledPrefetchNode({
                    targetTable: 'tags',
                    targetPrimaryKey: 'id',
                    targetKey: 'id',
                    targetColumns: { id: 'int', name: 'text' },
                }),
                [10, 11]
            );

            expect(targets.sql).toContain(expectedPlaceholders);
        });
    });

    it('includes nested joins when compiling direct and many-to-many target queries', () => {
        const compiler = new PrefetchQueryCompiler(mockMeta, postgresAdapter);
        const node = compiledPrefetchNode({
            targetTable: 'posts',
            targetPrimaryKey: 'id',
            targetKey: 'id',
            targetColumns: { id: 'int', author_id: 'int', title: 'text' },
            joinChildren: [
                compiledPrefetchNode({
                    relationName: 'author',
                    relationPath: 'posts__author',
                    loadMode: 'join',
                    cardinality: 'single',
                    sourceKey: 'author_id',
                    targetKey: 'id',
                    targetTable: 'authors',
                    targetPrimaryKey: 'id',
                    targetModelKey: 'tests/Author',
                    targetColumns: { id: 'int', team_id: 'int', name: 'text' },
                    join: {
                        alias: '__tango_join_posts_author',
                        columns: {
                            id: '__tango_hydrate_posts_author_id',
                            name: '__tango_hydrate_posts_author_name',
                        },
                    },
                    joinChildren: [
                        compiledPrefetchNode({
                            relationName: 'team',
                            relationPath: 'posts__author__team',
                            loadMode: 'join',
                            cardinality: 'single',
                            sourceKey: 'team_id',
                            targetKey: 'id',
                            targetTable: 'teams',
                            targetPrimaryKey: 'id',
                            targetModelKey: 'tests/Team',
                            targetColumns: { id: 'int', name: 'text' },
                            join: {
                                alias: '__tango_join_posts_author_team',
                                columns: {
                                    id: '__tango_hydrate_posts_author_team_id',
                                    name: '__tango_hydrate_posts_author_team_name',
                                },
                            },
                        }),
                    ],
                }),
            ],
        });

        const direct = compiler.compilePrefetch(node, [1]);
        const targets = compiler.compileManyToManyTargets(node, [1]);

        if (direct.kind !== InternalPrefetchQueryKind.DIRECT) {
            throw new Error('Expected direct compilation');
        }
        expect(direct.sql).toContain('LEFT JOIN authors __tango_join_posts_author');
        expect(direct.sql).toContain('LEFT JOIN teams __tango_join_posts_author_team');
        expect(targets.sql).toContain('LEFT JOIN authors __tango_join_posts_author');
        expect(targets.sql).toContain('LEFT JOIN teams __tango_join_posts_author_team');
    });

    it('ignores nested join SQL collection for nodes without join descriptors', () => {
        const compiler = new PrefetchQueryCompiler(mockMeta, postgresAdapter);
        const result = compiler.compilePrefetch(
            compiledPrefetchNode({
                joinChildren: [compiledPrefetchNode()],
            }),
            [1]
        );

        if (result.kind !== InternalPrefetchQueryKind.DIRECT) {
            throw new Error('Expected direct compilation');
        }
        expect(result.sql).not.toContain('LEFT JOIN');
    });

    it('rejects prefetch follow-up queries when compiled metadata fails validation', () => {
        const compiler = new PrefetchQueryCompiler(mockMeta, sqliteAdapter);

        expect(() =>
            compiler.compilePrefetch(
                compiledPrefetchNode({
                    targetTable: 'posts; DROP TABLE users;',
                    targetColumns: { id: 'int', author_id: 'int' },
                }),
                [1]
            )
        ).toThrow(/failed validation/iu);
    });

    it('surfaces non-Error validation failures from compiled prefetch metadata', () => {
        const compiler = new PrefetchQueryCompiler(mockMeta, postgresAdapter);
        const nonError = {
            [Symbol.toPrimitive]() {
                return 'boom';
            },
        };

        expect(() =>
            compiler.compilePrefetch(
                Object.defineProperty(compiledPrefetchNode(), 'targetTable', {
                    get() {
                        // oxlint-disable-next-line no-throw-literal -- Exercises non-Error metadata getter failures.
                        throw nonError;
                    },
                }),
                [1]
            )
        ).toThrow(/boom/u);
    });

    it('rejects nested prefetch join metadata when a compiled child node is mutated', () => {
        const compiler = new PrefetchQueryCompiler(mockMeta, postgresAdapter);

        expect(() =>
            compiler.compilePrefetch(
                compiledPrefetchNode({
                    joinChildren: [
                        compiledPrefetchNode({
                            relationName: 'author',
                            relationPath: 'posts__author',
                            loadMode: 'join',
                            cardinality: 'single',
                            sourceKey: 'author_id',
                            targetKey: 'id',
                            targetTable: 'authors',
                            targetModelKey: 'tests/Author',
                            targetColumns: { id: 'int', name: 'text' },
                            join: {
                                alias: '__tango_join_posts_author; DROP TABLE users;',
                                columns: {
                                    id: '__tango_hydrate_posts_author_id',
                                    name: '__tango_hydrate_posts_author_name',
                                },
                            },
                        }),
                    ],
                }),
                [1]
            )
        ).toThrow(/failed validation/iu);
    });

    it('rejects nested prefetch joins whose owner column is not present on the parent target', () => {
        const compiler = new PrefetchQueryCompiler(mockMeta, postgresAdapter);

        expect(() =>
            compiler.compilePrefetch(
                compiledPrefetchNode({
                    joinChildren: [
                        compiledPrefetchNode({
                            relationName: 'author',
                            relationPath: 'posts__author',
                            loadMode: 'join',
                            cardinality: 'single',
                            sourceKey: 'missing_owner_column',
                            targetKey: 'id',
                            targetTable: 'authors',
                            targetColumns: { id: 'int', name: 'text' },
                            join: {
                                alias: '__tango_join_posts_author',
                                columns: {
                                    id: '__tango_hydrate_posts_author_id',
                                    name: '__tango_hydrate_posts_author_name',
                                },
                            },
                        }),
                    ],
                }),
                [1]
            )
        ).toThrow(/unknown owner column/iu);
    });

    it('rejects nested prefetch joins whose projected columns are not present on the target', () => {
        const compiler = new PrefetchQueryCompiler(mockMeta, postgresAdapter);

        expect(() =>
            compiler.compilePrefetch(
                compiledPrefetchNode({
                    joinChildren: [
                        compiledPrefetchNode({
                            relationName: 'author',
                            relationPath: 'posts__author',
                            loadMode: 'join',
                            cardinality: 'single',
                            sourceKey: 'author_id',
                            targetKey: 'id',
                            targetTable: 'authors',
                            targetColumns: { id: 'int', name: 'text' },
                            join: {
                                alias: '__tango_join_posts_author',
                                columns: {
                                    missing: '__tango_hydrate_posts_author_missing',
                                },
                            },
                        }),
                    ],
                }),
                [1]
            )
        ).toThrow(/unknown nested join column/iu);
    });

    it('rejects generated prefetch aliases that collide with model fields', () => {
        const compiler = new PrefetchQueryCompiler(
            {
                ...mockMeta,
                columns: {
                    ...mockMeta.columns,
                    __tango_prefetch_base_posts: 'text',
                },
            },
            postgresAdapter
        );

        expect(() => compiler.compilePrefetch(compiledPrefetchNode(), [1])).toThrow(/internal query alias/iu);
    });
});
