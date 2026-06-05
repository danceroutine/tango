import { describe, it, expect } from 'vitest';
import { anAdapter, aRelationMeta } from '@danceroutine/tango-testing';
import { QueryCompiler } from '../QueryCompiler';
import type { TableMeta } from '../../domain/TableMeta';
import type { CompiledHydrationNode } from '../../domain/CompiledQuery';
import {
    sqlInjectionRejectCases,
    sqlInjectionValueCases,
    type SqlInjectionCase,
} from '../../../validation/tests/sqlInjectionCorpus';
import { expectPayloadIsParameterized } from '../../../validation/tests/expectPayloadIsParameterized';
import { InternalPrefetchQueryKind } from '../../domain/internal/InternalPrefetchQueryKind';
import { InternalRelationKind } from '../../domain/internal/InternalRelationKind';

type UserModel = {
    id: number;
    email: string;
    name: string;
    age: number;
    isActive: boolean;
};

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

function buildRejectQueryState(testCase: SqlInjectionCase): {
    meta: TableMeta;
    state: {
        order?: Array<{ by: string; dir: 'asc' }>;
        selectRelated?: string[];
        q?: { kind: 'atom'; where: Record<string, string> };
    };
} {
    switch (testCase.applicablePosition) {
        case 'identifier':
            return {
                meta: {
                    ...mockMeta,
                    table: testCase.payload,
                },
                state: {},
            };
        case 'order':
            return {
                meta: mockMeta,
                state: {
                    order: [{ by: testCase.payload, dir: 'asc' }],
                },
            };
        case 'relation':
            return {
                meta: {
                    ...mockMeta,
                    relations: {
                        organization: aRelationMeta({
                            kind: InternalRelationKind.BELONGS_TO,
                            table: testCase.payload,
                            sourceKey: 'organization_id',
                            targetKey: 'id',
                            targetColumns: { id: 'int' },
                            alias: 'organizations',
                        }),
                    },
                },
                state: {
                    selectRelated: ['organization'],
                },
            };
        case 'lookup_key':
            return {
                meta: mockMeta,
                state: {
                    q: {
                        kind: 'atom',
                        where: {
                            [`email__${testCase.payload}`]: 'safe',
                        },
                    },
                },
            };
        case 'value':
            throw new Error(`Cannot build a reject compiler state from value-position case '${testCase.id}'.`);
    }
}

describe(QueryCompiler, () => {
    it('splits many-to-many prefetch into a join-row read followed by a primary-key target read so the target query never joins the through table', () => {
        const compiler = new QueryCompiler(mockMeta, postgresAdapter);
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
            throw new Error('Expected manyToMany compilation');
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
    ])('uses $dialect placeholders for many-to-many', ({ adapter, expectedPlaceholders }) => {
        it('scopes the through-table read to owner ids', () => {
            const compiler = new QueryCompiler(mockMeta, adapter);
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
                throw new Error('Expected manyToMany compilation');
            }
            expect(compiled.throughSql).toContain(expectedPlaceholders);
        });

        it('scopes the follow-up target read to resolved target ids', () => {
            const compiler = new QueryCompiler(mockMeta, adapter);
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

    it('includes nested joins when compiling many-to-many target queries', () => {
        const compiler = new QueryCompiler(mockMeta, postgresAdapter);
        const targets = compiler.compileManyToManyTargets(
            compiledPrefetchNode({
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
        );

        expect(targets.sql).toContain('LEFT JOIN authors __tango_join_posts_author');
    });

    it('identifies matching instances', () => {
        const compiler = new QueryCompiler(mockMeta, postgresAdapter);
        expect(QueryCompiler.isQueryCompiler(compiler)).toBe(true);
        expect(QueryCompiler.isQueryCompiler({})).toBe(false);
    });

    it('compiles simple exact filter', () => {
        const state = {
            q: { kind: 'atom' as const, where: { email: 'test@example.com' } },
        };

        const result = new QueryCompiler(mockMeta, postgresAdapter).compile(state);

        expect(result.sql).toContain('WHERE');
        expect(result.sql).toContain('users.email = $1');
        expect(result.params).toEqual(['test@example.com']);
    });

    it('compiles order by', () => {
        const state = {
            order: [
                { by: 'name' as const, dir: 'asc' as const },
                { by: 'id' as const, dir: 'desc' as const },
            ],
        };

        const result = new QueryCompiler(mockMeta, postgresAdapter).compile(state);

        expect(result.sql).toContain('ORDER BY users.name ASC, users.id DESC');
    });

    it('compiles limit', () => {
        const state = {
            limit: 10,
        };

        const result = new QueryCompiler(mockMeta, postgresAdapter).compile(state);

        expect(result.sql).toContain('LIMIT 10');
    });

    it('compiles zero limit', () => {
        const state = {
            limit: 0,
        };

        const result = new QueryCompiler(mockMeta, postgresAdapter).compile(state);

        expect(result.sql).toContain('LIMIT 0');
    });

    it('compiles offset', () => {
        const state = {
            offset: 20,
        };

        const result = new QueryCompiler(mockMeta, postgresAdapter).compile(state);

        expect(result.sql).toContain('OFFSET 20');
    });

    it('compiles zero offset', () => {
        const state = {
            offset: 0,
        };

        const result = new QueryCompiler(mockMeta, postgresAdapter).compile(state);

        expect(result.sql).toContain('OFFSET 0');
    });

    it('compiles existence probes from scalar query state', () => {
        const result = new QueryCompiler(mockMeta, postgresAdapter).compileExists<UserModel>({
            q: { kind: 'atom', where: { email: 'test@example.com' } },
            excludes: [{ kind: 'atom', where: { name__contains: 'bot' } }],
            order: [{ by: 'age', dir: 'desc' }],
            offset: 20,
            select: ['id'],
        });

        expect(result.sql).toContain('SELECT 1 AS tango_exists FROM users');
        expect(result.sql).toContain('users.email = $1');
        expect(result.sql).toContain('NOT');
        expect(result.sql).toContain('users.name LIKE $2');
        expect(result.sql).toContain('ORDER BY users.age DESC');
        expect(result.sql).toContain('LIMIT 1 OFFSET 20');
        expect(result.sql).not.toContain('users.*');
        expect(result.params).toEqual(['test@example.com', '%bot%']);
        expect(result.hydrationPlan).toBeUndefined();
    });

    it('compiles existence probes without predicates', () => {
        const result = new QueryCompiler(mockMeta, postgresAdapter).compileExists({});

        expect(result.sql).toBe('SELECT 1 AS tango_exists FROM users LIMIT 1');
        expect(result.params).toEqual([]);
    });

    it('compiles existence probes with zero limit', () => {
        const result = new QueryCompiler(mockMeta, postgresAdapter).compileExists({ limit: 0 });

        expect(result.sql).toBe('SELECT 1 AS tango_exists FROM users ORDER BY users.id ASC LIMIT 0');
        expect(result.params).toEqual([]);
    });

    it('compiles existence probes with zero offset', () => {
        const result = new QueryCompiler(mockMeta, postgresAdapter).compileExists({ offset: 0 });

        expect(result.sql).toBe('SELECT 1 AS tango_exists FROM users ORDER BY users.id ASC LIMIT 1 OFFSET 0');
        expect(result.params).toEqual([]);
    });

    it('compiles existence probes with zero limit and offset', () => {
        const result = new QueryCompiler(mockMeta, postgresAdapter).compileExists({ limit: 0, offset: 5 });

        expect(result.sql).toBe('SELECT 1 AS tango_exists FROM users ORDER BY users.id ASC LIMIT 0 OFFSET 5');
        expect(result.params).toEqual([]);
    });

    it('compiles SQLite existence probes with a non-keyword result alias', () => {
        const result = new QueryCompiler(mockMeta, sqliteAdapter).compileExists({});

        expect(result.sql).toBe('SELECT 1 AS tango_exists FROM users LIMIT 1');
    });

    it('omits empty existence predicates', () => {
        const result = new QueryCompiler(mockMeta, postgresAdapter).compileExists<UserModel>({
            q: { kind: 'atom', where: {} },
            excludes: [{ kind: 'atom', where: {} }],
        });

        expect(result.sql).toBe('SELECT 1 AS tango_exists FROM users LIMIT 1');
        expect(result.params).toEqual([]);
    });

    describe('SQLite', () => {
        it('uses SQLite unlimited limit syntax when offset is set without a limit', () => {
            const state = {
                offset: 0,
            };

            const result = new QueryCompiler(mockMeta, sqliteAdapter).compile(state);

            expect(result.sql).toContain('LIMIT -1 OFFSET 0');
        });

        it('keeps the requested SQLite limit when limit and offset are set', () => {
            const state = {
                limit: 10,
                offset: 0,
            };

            const result = new QueryCompiler(mockMeta, sqliteAdapter).compile(state);

            expect(result.sql).toContain('LIMIT 10 OFFSET 0');
        });

        it.each(sqlInjectionValueCases)('$id keeps $category payloads parameterized in sqlite filters', (testCase) => {
            const result = new QueryCompiler(mockMeta, sqliteAdapter).compile({
                q: { kind: 'atom', where: { email: testCase.payload } },
            });

            expectPayloadIsParameterized(result.sql, result.params, testCase.payload);
            expect(result.sql).toContain('?');
        });
    });

    it('compiles selectRelated joins and excludes', () => {
        const compiler = new QueryCompiler(
            {
                ...mockMeta,
                relations: {
                    organization: aRelationMeta({
                        kind: InternalRelationKind.BELONGS_TO,
                        table: 'organizations',
                        alias: 'org',
                        sourceKey: 'organization_id',
                        targetKey: 'id',
                        targetColumns: { id: 'int', name: 'text' },
                    }),
                    posts: aRelationMeta({
                        kind: InternalRelationKind.HAS_MANY,
                        table: 'posts',
                        alias: 'posts',
                        sourceKey: 'id',
                        targetKey: 'author_id',
                        targetColumns: { id: 'int', author_id: 'int' },
                    }),
                },
            },
            postgresAdapter
        );

        const result = compiler.compile<UserModel>({
            q: { kind: 'atom', where: { email: 'test@example.com' } },
            excludes: [{ kind: 'atom', where: { name__contains: 'spam' } }],
            selectRelated: ['organization'],
            select: ['id'],
            order: [{ by: 'id', dir: 'desc' }],
        });

        expect(result.sql).toContain(
            'SELECT users.id, __tango_join_organization.id AS __tango_hydrate_organization_id, __tango_join_organization.name AS __tango_hydrate_organization_name FROM users LEFT JOIN organizations __tango_join_organization ON __tango_join_organization.id = users.organization_id'
        );
        expect(result.sql).toContain('WHERE');
        expect(result.sql).toContain('NOT');
        expect(result.params).toEqual(['test@example.com', '%spam%']);
    });

    it('rejects relation names used with the wrong eager-loading method', () => {
        const compiler = new QueryCompiler(
            {
                ...mockMeta,
                relations: {
                    posts: aRelationMeta({
                        kind: InternalRelationKind.HAS_MANY,
                        table: 'posts',
                        alias: 'posts',
                        sourceKey: 'id',
                        targetKey: 'author_id',
                        targetColumns: { id: 'int', author_id: 'int' },
                    }),
                    organization: aRelationMeta({
                        kind: InternalRelationKind.BELONGS_TO,
                        table: 'organizations',
                        alias: 'org',
                        sourceKey: 'organization_id',
                        targetKey: 'id',
                        targetColumns: { id: 'int' },
                    }),
                },
            },
            postgresAdapter
        );

        expect(() => compiler.compile({ selectRelated: ['posts'] })).toThrow(/selectRelated/);
        expect(() => compiler.compile({ prefetchRelated: ['organization'] })).not.toThrow();
    });

    it('compiles validated prefetch follow-up queries', () => {
        const compiler = new QueryCompiler(
            {
                ...mockMeta,
                relations: {
                    posts: aRelationMeta({
                        kind: InternalRelationKind.HAS_MANY,
                        table: 'posts',
                        alias: 'posts',
                        sourceKey: 'id',
                        targetKey: 'author_id',
                        targetColumns: { id: 'int', author_id: 'int', title: 'text' },
                    }),
                },
            },
            postgresAdapter
        );
        const result = compiler.compilePrefetch(compiledPrefetchNode(), [1, 2]);

        expect(result).toEqual({
            kind: InternalPrefetchQueryKind.DIRECT,
            sql: 'SELECT __tango_prefetch_base_posts.id AS id, __tango_prefetch_base_posts.author_id AS author_id, __tango_prefetch_base_posts.title AS title FROM posts __tango_prefetch_base_posts WHERE __tango_prefetch_base_posts.author_id IN ($1, $2) ORDER BY __tango_prefetch_base_posts.author_id ASC, __tango_prefetch_base_posts.id ASC',
            params: [1, 2],
            targetKey: 'author_id',
            targetColumns: { id: 'int', author_id: 'int', title: 'text' },
        });
    });

    it('compiles nested join descendants for selectRelated paths', () => {
        const compiler = new QueryCompiler(
            {
                table: 'users',
                pk: 'id',
                columns: { id: 'int', organization_id: 'int' },
                relations: {
                    organization: aRelationMeta({
                        kind: InternalRelationKind.BELONGS_TO,
                        table: 'organizations',
                        alias: 'organization',
                        sourceKey: 'organization_id',
                        targetKey: 'id',
                        targetColumns: { id: 'int', owner_id: 'int' },
                        targetMeta: {
                            table: 'organizations',
                            pk: 'id',
                            columns: { id: 'int', owner_id: 'int' },
                            relations: {
                                owner: aRelationMeta({
                                    kind: InternalRelationKind.BELONGS_TO,
                                    table: 'owners',
                                    alias: 'owner',
                                    sourceKey: 'owner_id',
                                    targetKey: 'id',
                                    targetColumns: { id: 'int', name: 'text' },
                                }),
                            },
                        },
                    }),
                },
            },
            postgresAdapter
        );

        const result = compiler.compile({ selectRelated: ['organization__owner'] });

        expect(result.sql).toContain('LEFT JOIN organizations __tango_join_organization');
        expect(result.sql).toContain('LEFT JOIN owners __tango_join_organization_owner');
        expect(result.sql).toContain('__tango_hydrate_organization_owner_name');
    });

    it('compiles mixed join and nested prefetch descendants from one normalized path graph', () => {
        const compiler = new QueryCompiler(
            {
                table: 'users',
                pk: 'id',
                columns: { id: 'int', organization_id: 'int' },
                relations: {
                    organization: aRelationMeta({
                        kind: InternalRelationKind.BELONGS_TO,
                        table: 'organizations',
                        alias: 'organization',
                        sourceKey: 'organization_id',
                        targetKey: 'id',
                        targetColumns: { id: 'int' },
                        targetMeta: {
                            table: 'organizations',
                            pk: 'id',
                            columns: { id: 'int' },
                            relations: {
                                posts: aRelationMeta({
                                    kind: InternalRelationKind.HAS_MANY,
                                    table: 'posts',
                                    alias: 'posts',
                                    sourceKey: 'id',
                                    targetKey: 'organization_id',
                                    targetColumns: { id: 'int', organization_id: 'int', author_id: 'int' },
                                    targetMeta: {
                                        table: 'posts',
                                        pk: 'id',
                                        columns: { id: 'int', organization_id: 'int', author_id: 'int' },
                                        relations: {
                                            author: aRelationMeta({
                                                kind: InternalRelationKind.BELONGS_TO,
                                                table: 'authors',
                                                alias: 'author',
                                                sourceKey: 'author_id',
                                                targetKey: 'id',
                                                targetColumns: { id: 'int', team_id: 'int' },
                                                targetMeta: {
                                                    table: 'authors',
                                                    pk: 'id',
                                                    columns: { id: 'int', team_id: 'int' },
                                                    relations: {
                                                        team: aRelationMeta({
                                                            kind: InternalRelationKind.BELONGS_TO,
                                                            table: 'teams',
                                                            alias: 'team',
                                                            sourceKey: 'team_id',
                                                            targetKey: 'id',
                                                            targetColumns: { id: 'int', name: 'text' },
                                                        }),
                                                    },
                                                },
                                            }),
                                        },
                                    },
                                }),
                            },
                        },
                    }),
                },
            },
            postgresAdapter
        );

        const compiled = compiler.compile({ prefetchRelated: ['organization__posts__author__team'] });
        const organization = compiled.hydrationPlan!.joinNodes[0]!;
        const posts = organization.prefetchChildren[0]!;
        const prefetch = compiler.compilePrefetch(posts, [1]);

        expect(organization.prefetchChildren).toHaveLength(1);
        if (prefetch.kind !== InternalPrefetchQueryKind.DIRECT) {
            expect(prefetch.kind).toBe(InternalPrefetchQueryKind.DIRECT);
            return;
        }
        expect(prefetch.sql).toContain('LEFT JOIN authors __tango_join_organization_posts_author');
        expect(prefetch.sql).toContain('LEFT JOIN teams __tango_join_organization_posts_author_team');
    });

    it('rejects prefetch follow-up queries when compiled metadata no longer matches validated relation metadata', () => {
        const compiler = new QueryCompiler(
            {
                ...mockMeta,
                relations: {
                    posts: aRelationMeta({
                        kind: InternalRelationKind.HAS_MANY,
                        table: 'posts',
                        alias: 'posts',
                        sourceKey: 'id',
                        targetKey: 'author_id',
                        targetColumns: { id: 'int', author_id: 'int' },
                    }),
                },
            },
            sqliteAdapter
        );

        expect(() =>
            compiler.compilePrefetch(
                compiledPrefetchNode({
                    targetTable: 'posts; DROP TABLE users;',
                    targetColumns: { id: 'int', author_id: 'int' },
                }),
                [1]
            )
        ).toThrow(/failed validation/i);
    });

    it('rejects nested prefetch join metadata when a compiled child node is mutated', () => {
        const compiler = new QueryCompiler(mockMeta, postgresAdapter);

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
        ).toThrow(/failed validation/i);
    });

    it('rejects nested prefetch joins whose owner column is not present on the parent target', () => {
        const compiler = new QueryCompiler(mockMeta, postgresAdapter);

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
        ).toThrow(/unknown owner column/i);
    });

    it('rejects nested prefetch joins whose projected columns are not present on the target', () => {
        const compiler = new QueryCompiler(mockMeta, postgresAdapter);

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
        ).toThrow(/unknown nested join column/i);
    });

    it('ignores empty excludes that produce no SQL', () => {
        const compiler = new QueryCompiler(mockMeta, postgresAdapter);
        const result = compiler.compile({
            excludes: [{ kind: 'atom', where: { email: undefined } }],
        });

        expect(result.sql).not.toContain('WHERE');
        expect(result.params).toEqual([]);
    });

    it('throws on unknown lookups', () => {
        const compiler = new QueryCompiler(mockMeta, postgresAdapter);
        expect(() => compiler.compile({ q: { kind: 'atom', where: { id__wat: 1 } } })).toThrow(
            "Invalid SQL lookup key: 'id__wat'."
        );
    });

    it('rejects suspicious identifiers before emitting SQL', () => {
        const compiler = new QueryCompiler(
            {
                ...mockMeta,
                table: 'users; DROP TABLE users;',
            },
            postgresAdapter
        );

        expect(() => compiler.compile({})).toThrow(/invalid sql table name/i);
    });

    it('rejects belongsTo relations whose local key is not a known column', () => {
        const compiler = new QueryCompiler(
            {
                ...mockMeta,
                relations: {
                    organization: aRelationMeta({
                        kind: InternalRelationKind.BELONGS_TO,
                        table: 'organizations',
                        alias: 'org',
                        sourceKey: 'missing_column',
                        targetKey: 'id',
                        targetColumns: { id: 'int' },
                    }),
                },
            },
            postgresAdapter
        );

        expect(() => compiler.compile({ selectRelated: ['organization'] })).toThrow(/unknown column/i);
    });

    it('rejects belongsTo relations whose target key is not a known target column', () => {
        const compiler = new QueryCompiler(
            {
                ...mockMeta,
                relations: {
                    organization: aRelationMeta({
                        kind: InternalRelationKind.BELONGS_TO,
                        table: 'organizations',
                        alias: 'org',
                        sourceKey: 'organization_id',
                        targetKey: 'missing',
                        targetColumns: { id: 'int' },
                    }),
                },
            },
            postgresAdapter
        );

        expect(() => compiler.compile({ selectRelated: ['organization'] })).toThrow(/unknown relation target key/i);
    });

    it('rejects internal hydration aliases that collide with model fields', () => {
        const compiler = new QueryCompiler(
            {
                ...mockMeta,
                columns: {
                    ...mockMeta.columns,
                    __tango_hydrate_organization_id: 'text',
                },
                relations: {
                    organization: aRelationMeta({
                        kind: InternalRelationKind.BELONGS_TO,
                        table: 'organizations',
                        alias: 'org',
                        sourceKey: 'organization_id',
                        targetKey: 'id',
                        targetColumns: { id: 'int' },
                    }),
                },
            },
            postgresAdapter
        );

        expect(() => compiler.compile({ selectRelated: ['organization'] })).toThrow(/internal query alias/i);
    });

    describe('PostgreSQL', () => {
        it.each(sqlInjectionValueCases)('$id keeps $category payloads as bound filter params', (testCase) => {
            const result = new QueryCompiler(mockMeta, postgresAdapter).compile({
                q: { kind: 'atom', where: { email: testCase.payload } },
            });

            expectPayloadIsParameterized(result.sql, result.params, testCase.payload);
        });

        it.each(sqlInjectionRejectCases)('$id rejects $applicablePosition payloads before SQL assembly', (testCase) => {
            const { meta, state } = buildRejectQueryState(testCase);
            expect(() => new QueryCompiler(meta, postgresAdapter).compile(state)).toThrow();
        });
    });
});
