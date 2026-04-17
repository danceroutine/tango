import { describe, it, expect } from 'vitest';
import { aRelationMeta } from '@danceroutine/tango-testing';
import { QueryCompiler } from '../QueryCompiler';
import { Q } from '../..';
import type { QNode } from '../../domain/QNode';
import type { TableMeta } from '../../domain/TableMeta';
import type { CompiledHydrationNode } from '../../domain/CompiledQuery';
import type { QueryHydrationPlanNode } from '../../planning';
import {
    sqlInjectionRejectCases,
    sqlInjectionValueCases,
    type SqlInjectionCase,
} from '../../../validation/tests/sqlInjectionCorpus';
import { expectPayloadIsParameterized } from '../../../validation/tests/expectPayloadIsParameterized';
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
    it('identifies matching instances', () => {
        const compiler = new QueryCompiler(mockMeta, 'postgres');
        expect(QueryCompiler.isQueryCompiler(compiler)).toBe(true);
        expect(QueryCompiler.isQueryCompiler({})).toBe(false);
    });

    it('compiles simple exact filter', () => {
        const state = {
            q: { kind: 'atom' as const, where: { email: 'test@example.com' } },
        };

        const result = new QueryCompiler(mockMeta, 'postgres').compile(state);

        expect(result.sql).toContain('WHERE');
        expect(result.sql).toContain('users.email = $1');
        expect(result.params).toEqual(['test@example.com']);
    });

    it('compiles null value as IS NULL', () => {
        const state = {
            q: { kind: 'atom' as const, where: { email: null } },
        };

        const result = new QueryCompiler(mockMeta, 'postgres').compile(state);

        expect(result.sql).toContain('users.email IS NULL');
        expect(result.params).toEqual([]);
    });

    it('compiles lt lookup', () => {
        const state = {
            q: { kind: 'atom' as const, where: { age__lt: 30 } },
        };

        const result = new QueryCompiler(mockMeta, 'postgres').compile(state);

        expect(result.sql).toContain('users.age < $1');
        expect(result.params).toEqual([30]);
    });

    it('compiles gte lookup', () => {
        const state = {
            q: { kind: 'atom' as const, where: { age__gte: 18 } },
        };

        const result = new QueryCompiler(mockMeta, 'postgres').compile(state);

        expect(result.sql).toContain('users.age >= $1');
        expect(result.params).toEqual([18]);
    });

    it('compiles lte and gt lookups', () => {
        const lteState = {
            q: { kind: 'atom' as const, where: { age__lte: 65 } },
        };
        const gtState = {
            q: { kind: 'atom' as const, where: { age__gt: 21 } },
        };

        const lte = new QueryCompiler(mockMeta, 'postgres').compile(lteState);
        const gt = new QueryCompiler(mockMeta, 'postgres').compile(gtState);

        expect(lte.sql).toContain('users.age <= $1');
        expect(gt.sql).toContain('users.age > $1');
    });

    it('compiles in lookup', () => {
        const state = {
            q: { kind: 'atom' as const, where: { id__in: [1, 2, 3] } },
        };

        const result = new QueryCompiler(mockMeta, 'postgres').compile(state);

        expect(result.sql).toContain('users.id IN ($1, $2, $3)');
        expect(result.params).toEqual([1, 2, 3]);
    });

    it('compiles empty in as always false', () => {
        const state = {
            q: { kind: 'atom' as const, where: { id__in: [] } },
        };

        const result = new QueryCompiler(mockMeta, 'postgres').compile(state);

        expect(result.sql).toContain('1=0');
    });

    it('compiles isnull lookup', () => {
        const state = {
            q: { kind: 'atom' as const, where: { email__isnull: true } },
        };

        const result = new QueryCompiler(mockMeta, 'postgres').compile(state);

        expect(result.sql).toContain('users.email IS NULL');
    });

    it('compiles isnull false', () => {
        const state = {
            q: { kind: 'atom' as const, where: { email__isnull: false } },
        };

        const result = new QueryCompiler(mockMeta, 'postgres').compile(state);

        expect(result.sql).toContain('users.email IS NOT NULL');
    });

    it('compiles contains lookup', () => {
        const state = {
            q: { kind: 'atom' as const, where: { name__contains: 'John' } },
        };

        const result = new QueryCompiler(mockMeta, 'postgres').compile(state);

        expect(result.sql).toContain('users.name LIKE $1');
        expect(result.params).toEqual(['%John%']);
    });

    it('compiles icontains lookup', () => {
        const state = {
            q: { kind: 'atom' as const, where: { name__icontains: 'JOHN' } },
        };

        const result = new QueryCompiler(mockMeta, 'postgres').compile(state);

        expect(result.sql).toContain('LOWER(users.name) LIKE $1');
        expect(result.params).toEqual(['%john%']);
    });

    it('compiles startswith lookup', () => {
        const state = {
            q: { kind: 'atom' as const, where: { email__startswith: 'admin' } },
        };

        const result = new QueryCompiler(mockMeta, 'postgres').compile(state);

        expect(result.sql).toContain('users.email LIKE $1');
        expect(result.params).toEqual(['admin%']);
    });

    it('compiles endswith lookup', () => {
        const state = {
            q: { kind: 'atom' as const, where: { email__endswith: '.com' } },
        };

        const result = new QueryCompiler(mockMeta, 'postgres').compile(state);

        expect(result.sql).toContain('users.email LIKE $1');
        expect(result.params).toEqual(['%.com']);
    });

    it('compiles case-insensitive startswith and endswith lookups', () => {
        const startsWithState = {
            q: { kind: 'atom' as const, where: { email__istartswith: 'ADMIN' } },
        };
        const endsWithState = {
            q: { kind: 'atom' as const, where: { email__iendswith: '.COM' } },
        };

        const startsWith = new QueryCompiler(mockMeta, 'postgres').compile(startsWithState);
        const endsWith = new QueryCompiler(mockMeta, 'postgres').compile(endsWithState);

        expect(startsWith.sql).toContain('LOWER(users.email) LIKE $1');
        expect(startsWith.params).toEqual(['admin%']);
        expect(endsWith.sql).toContain('LOWER(users.email) LIKE $1');
        expect(endsWith.params).toEqual(['%.com']);
    });

    it('compiles AND node', () => {
        const state = {
            q: Q.and<UserModel>({ email: 'test@example.com' }, { age__gte: 18 }),
        };

        const result = new QueryCompiler(mockMeta, 'postgres').compile(state);

        expect(result.sql).toContain('users.email = $1');
        expect(result.sql).toContain('users.age >= $2');
        expect(result.sql).toContain('AND');
        expect(result.params).toEqual(['test@example.com', 18]);
    });

    it('compiles OR node', () => {
        const state = {
            q: Q.or({ email: 'test@example.com' }, { email: 'admin@example.com' }),
        };

        const result = new QueryCompiler(mockMeta, 'postgres').compile(state);

        expect(result.sql).toContain('users.email = $1');
        expect(result.sql).toContain('users.email = $2');
        expect(result.sql).toContain('OR');
        expect(result.params).toEqual(['test@example.com', 'admin@example.com']);
    });

    it('compiles NOT node', () => {
        const state = {
            q: Q.not({ email: 'test@example.com' }),
        };

        const result = new QueryCompiler(mockMeta, 'postgres').compile(state);

        expect(result.sql).toContain('NOT');
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

        const result = new QueryCompiler(mockMeta, 'postgres').compile(state);

        expect(result.sql).toContain('ORDER BY users.name ASC, users.id DESC');
    });

    it('compiles limit', () => {
        const state = {
            limit: 10,
        };

        const result = new QueryCompiler(mockMeta, 'postgres').compile(state);

        expect(result.sql).toContain('LIMIT 10');
    });

    it('compiles offset', () => {
        const state = {
            offset: 20,
        };

        const result = new QueryCompiler(mockMeta, 'postgres').compile(state);

        expect(result.sql).toContain('OFFSET 20');
    });

    describe('SQLite', () => {
        it('uses SQLite placeholders', () => {
            const state = {
                q: { kind: 'atom' as const, where: { email: 'test@example.com' } },
            };

            const result = new QueryCompiler(mockMeta, 'sqlite').compile(state);

            expect(result.sql).toContain('users.email = ?');
            expect(result.params).toEqual(['test@example.com']);
        });

        it('uses SQLite placeholders for IN lookups', () => {
            const state = {
                q: { kind: 'atom' as const, where: { id__in: [1, 2] } },
            };

            const result = new QueryCompiler(mockMeta, 'sqlite').compile(state);
            expect(result.sql).toContain('users.id IN (?, ?)');
            expect(result.params).toEqual([1, 2]);
        });

        it('normalizes sqlite booleans and supports non-array IN values', () => {
            const result = new QueryCompiler(mockMeta, 'sqlite').compile({
                q: Q.and<UserModel>({ isActive: true }, { id__in: 9 }),
            });

            expect(result.sql).toContain('users.isActive = ?');
            expect(result.sql).toContain('users.id IN (?)');
            expect(result.params).toEqual([1, 9]);
        });

        it('uses sqlite non-lowercase columns for case-insensitive lookups', () => {
            const contains = new QueryCompiler(mockMeta, 'sqlite').compile({
                q: { kind: 'atom', where: { email__icontains: 'ADMIN' } },
            });
            const startsWith = new QueryCompiler(mockMeta, 'sqlite').compile({
                q: { kind: 'atom', where: { email__istartswith: 'ADMIN' } },
            });
            const endsWith = new QueryCompiler(mockMeta, 'sqlite').compile({
                q: { kind: 'atom', where: { email__iendswith: '.COM' } },
            });

            expect(contains.sql).toContain('users.email LIKE ?');
            expect(contains.params).toEqual(['%admin%']);
            expect(startsWith.sql).toContain('users.email LIKE ?');
            expect(startsWith.params).toEqual(['admin%']);
            expect(endsWith.sql).toContain('users.email LIKE ?');
            expect(endsWith.params).toEqual(['%.com']);
        });

        it('normalizes sqlite false booleans to zero', () => {
            const result = new QueryCompiler(mockMeta, 'sqlite').compile({
                q: { kind: 'atom', where: { isActive: false } },
            });
            expect(result.params).toEqual([0]);
        });

        it.each(sqlInjectionValueCases)('$id keeps $category payloads parameterized in sqlite filters', (testCase) => {
            const result = new QueryCompiler(mockMeta, 'sqlite').compile({
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
            'postgres'
        );

        const result = compiler.compile<UserModel>({
            q: Q.and<UserModel>({ email: 'test@example.com' }, { age__gte: 18 }),
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
        expect(result.params).toEqual(['test@example.com', 18, '%spam%']);
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
            'postgres'
        );

        expect(() => compiler.compile({ selectRelated: ['posts'] })).toThrow(/selectRelated/);
        expect(() => compiler.compile({ prefetchRelated: ['organization'] })).toThrow(/prefetchRelated/);
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
            'postgres'
        );
        const result = compiler.compilePrefetch(compiledPrefetchNode(), [1, 2]);

        expect(result).toEqual({
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
            'postgres'
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
            'postgres'
        );

        const compiled = compiler.compile({ prefetchRelated: ['organization__posts__author__team'] });
        const organization = compiled.hydrationPlan!.joinNodes[0]!;
        const posts = organization.prefetchChildren[0]!;
        const prefetch = compiler.compilePrefetch(posts, [1]);

        expect(organization.prefetchChildren).toHaveLength(1);
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
            'sqlite'
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
        const compiler = new QueryCompiler(mockMeta, 'postgres');

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

    it('rejects compiled hydration nodes that no longer carry target metadata', () => {
        const compiler = new QueryCompiler(mockMeta, 'postgres') as unknown as {
            compileHydrationNode: (
                node: QueryHydrationPlanNode,
                context: {
                    rootTable: string;
                    ownerMeta: TableMeta;
                    ownerAlias: string;
                    collectRootJoins: boolean;
                    hiddenRootAliases: string[];
                    joinCollection: { selects: string[]; joins: string[] };
                }
            ) => unknown;
        };

        expect(() =>
            compiler.compileHydrationNode(
                {
                    nodeId: 'organization',
                    relationName: 'organization',
                    relationPath: 'organization',
                    ownerModelKey: 'tests/User',
                    relationEdge: {
                        ...aRelationMeta({
                            kind: InternalRelationKind.BELONGS_TO,
                            table: 'organizations',
                            alias: 'organization',
                            sourceKey: 'organization_id',
                            targetKey: 'id',
                            targetColumns: { id: 'int' },
                        }),
                        targetMeta: undefined,
                    },
                    targetModelKey: 'tests/Organization',
                    loadMode: 'join',
                    cardinality: 'single',
                    provenance: ['organization'],
                    joinChildren: [],
                    prefetchChildren: [],
                },
                {
                    rootTable: 'users',
                    ownerMeta: {
                        ...mockMeta,
                        relations: {
                            organization: aRelationMeta({
                                kind: InternalRelationKind.BELONGS_TO,
                                table: 'organizations',
                                alias: 'organization',
                                sourceKey: 'organization_id',
                                targetKey: 'id',
                                targetColumns: { id: 'int' },
                            }),
                        },
                    },
                    ownerAlias: 'users',
                    collectRootJoins: true,
                    hiddenRootAliases: [],
                    joinCollection: { selects: [], joins: [] },
                }
            )
        ).toThrow(/missing target metadata/i);
    });

    it('ignores nested join SQL collection for nodes without join descriptors', () => {
        const compiler = new QueryCompiler(mockMeta, 'postgres') as unknown as {
            collectNestedJoinSql: (
                node: CompiledHydrationNode,
                ownerAlias: string,
                collection: { selects: string[]; joins: string[] }
            ) => void;
        };
        const collection = { selects: [], joins: [] };

        compiler.collectNestedJoinSql(compiledPrefetchNode(), 'users', collection);

        expect(collection).toEqual({ selects: [], joins: [] });
    });

    it('rejects nested prefetch joins whose owner column is not present on the parent target', () => {
        const compiler = new QueryCompiler(mockMeta, 'postgres');

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
        const compiler = new QueryCompiler(mockMeta, 'postgres');

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

    it('surfaces non-Error validation failures from compiled prefetch metadata', () => {
        const compiler = new QueryCompiler(mockMeta, 'postgres') as unknown as {
            validatePrefetchTarget: (node: CompiledHydrationNode) => unknown;
        };

        expect(() =>
            compiler.validatePrefetchTarget(
                Object.defineProperty(compiledPrefetchNode(), 'targetTable', {
                    get() {
                        throw 'boom';
                    },
                })
            )
        ).toThrow(/boom/);
    });

    it('ignores empty excludes that produce no SQL', () => {
        const compiler = new QueryCompiler(mockMeta, 'postgres');
        const result = compiler.compile({
            excludes: [{ kind: 'atom', where: { email: undefined } }],
        });

        expect(result.sql).not.toContain('WHERE');
        expect(result.params).toEqual([]);
    });

    it('throws on unknown lookups', () => {
        const compiler = new QueryCompiler(mockMeta, 'postgres');
        expect(() => compiler.compile({ q: { kind: 'atom', where: { id__wat: 1 } } })).toThrow('Unknown lookup: wat');
    });

    it('defensively rejects unsupported lookup values during SQL rendering', () => {
        const compiler = new QueryCompiler(mockMeta, 'postgres') as unknown as {
            lookupToSQL: (column: string, lookup: string, value: unknown, paramIndex: number) => unknown;
        };

        expect(() => compiler.lookupToSQL('users.email', 'wat', 'payload', 1)).toThrow('Unknown lookup: wat');
    });

    it('ignores q-nodes with unknown kind', () => {
        const compiler = new QueryCompiler(mockMeta, 'postgres');
        const result = compiler.compile({
            q: {
                kind: 'unknown_kind' as unknown as 'atom',
            } as unknown as Parameters<QueryCompiler['compile']>[0]['q'],
        });

        expect(result.sql).toContain('SELECT users.* FROM users');
        expect(result.params).toEqual([]);
    });

    it('returns empty sql for NOT nodes that compile to empty clauses', () => {
        const compiler = new QueryCompiler(mockMeta, 'postgres');
        const result = compiler.compile({
            q: Q.not({ email: undefined }),
        });

        expect(result.sql).toContain('SELECT users.* FROM users');
        expect(result.sql).not.toContain('WHERE');
    });

    it('drops empty AND/OR children from compiled predicates', () => {
        const compiler = new QueryCompiler(mockMeta, 'postgres');
        const andResult = compiler.compile<UserModel>({
            q: {
                kind: 'and',
                nodes: [
                    { kind: 'atom', where: { email: undefined } },
                    { kind: 'atom', where: { id: 1 } },
                ] as QNode<UserModel>[],
            },
        });
        const orResult = compiler.compile<UserModel>({
            q: {
                kind: 'or',
                nodes: [
                    { kind: 'atom', where: { email: undefined } },
                    { kind: 'atom', where: { id: 2 } },
                ] as QNode<UserModel>[],
            },
        });

        expect(andResult.sql).toContain('users.id = $1');
        expect(andResult.params).toEqual([1]);
        expect(orResult.sql).toContain('users.id = $1');
        expect(orResult.params).toEqual([2]);
    });

    it('returns empty predicates for fully empty AND/OR nodes', () => {
        const compiler = new QueryCompiler(mockMeta, 'postgres');
        const andResult = compiler.compile({
            q: { kind: 'and', nodes: [{ kind: 'atom', where: { email: undefined } }] },
        });
        const orResult = compiler.compile({
            q: { kind: 'or', nodes: [{ kind: 'atom', where: { email: undefined } }] },
        });

        expect(andResult.sql).not.toContain('WHERE');
        expect(orResult.sql).not.toContain('WHERE');
    });

    it('handles AND/OR nodes without nodes arrays', () => {
        const compiler = new QueryCompiler(mockMeta, 'postgres');
        const andResult = compiler.compile({ q: { kind: 'and' } });
        const orResult = compiler.compile({ q: { kind: 'or' } });
        expect(andResult.sql).not.toContain('WHERE');
        expect(orResult.sql).not.toContain('WHERE');
    });

    it('handles ATOM nodes without where objects', () => {
        const compiler = new QueryCompiler(mockMeta, 'postgres');
        const result = compiler.compile({ q: { kind: 'atom' } });
        expect(result.sql).not.toContain('WHERE');
        expect(result.params).toEqual([]);
    });

    it('rejects suspicious identifiers before emitting SQL', () => {
        const compiler = new QueryCompiler(
            {
                ...mockMeta,
                table: 'users; DROP TABLE users;',
            },
            'postgres'
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
            'postgres'
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
            'postgres'
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
            'postgres'
        );

        expect(() => compiler.compile({ selectRelated: ['organization'] })).toThrow(/internal query alias/i);
    });

    describe('PostgreSQL', () => {
        it.each(sqlInjectionValueCases)('$id keeps $category payloads as bound filter params', (testCase) => {
            const result = new QueryCompiler(mockMeta, 'postgres').compile({
                q: { kind: 'atom', where: { email: testCase.payload } },
            });

            expectPayloadIsParameterized(result.sql, result.params, testCase.payload);
        });

        it.each(sqlInjectionRejectCases)('$id rejects $applicablePosition payloads before SQL assembly', (testCase) => {
            const { meta, state } = buildRejectQueryState(testCase);
            expect(() => new QueryCompiler(meta, 'postgres').compile(state)).toThrow();
        });
    });
});
