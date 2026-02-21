import { describe, it, expect } from 'vitest';
import { QueryCompiler } from '../QueryCompiler';
import { Q } from '../..';
import type { QNode } from '../../domain/QNode';
import type { TableMeta } from '../../domain/TableMeta';
import {
    sqlInjectionRejectCases,
    sqlInjectionValueCases,
    type SqlInjectionCase,
} from '../../../validation/tests/sqlInjectionCorpus';
import { expectPayloadIsParameterized } from '../../../validation/tests/expectPayloadIsParameterized';

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
                        organization: {
                            kind: 'belongsTo',
                            table: testCase.payload,
                            targetPk: 'id',
                            localKey: 'organization_id',
                            alias: 'organizations',
                        },
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
                    organization: {
                        kind: 'belongsTo',
                        table: 'organizations',
                        alias: 'org',
                        localKey: 'organization_id',
                        targetPk: 'id',
                    },
                    posts: {
                        kind: 'hasMany',
                        table: 'posts',
                        alias: 'posts',
                        localKey: 'id',
                        targetPk: 'author_id',
                    },
                },
            },
            'postgres'
        );

        const result = compiler.compile<UserModel>({
            q: Q.and<UserModel>({ email: 'test@example.com' }, { age__gte: 18 }),
            excludes: [{ kind: 'atom', where: { name__contains: 'spam' } }],
            selectRelated: ['organization', 'posts', 'missing'],
            select: ['id'],
            order: [{ by: 'id', dir: 'desc' }],
        });

        expect(result.sql).toContain(
            'SELECT users.id FROM users LEFT JOIN organizations org ON org.id = users.organization_id'
        );
        expect(result.sql).toContain('WHERE');
        expect(result.sql).toContain('NOT');
        expect(result.params).toEqual(['test@example.com', 18, '%spam%']);
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
                    organization: {
                        kind: 'belongsTo',
                        table: 'organizations',
                        alias: 'org',
                        localKey: 'missing_column',
                        targetPk: 'id',
                    },
                },
            },
            'postgres'
        );

        expect(() => compiler.compile({ selectRelated: ['organization'] })).toThrow(/unknown column/i);
    });

    it('rejects belongsTo relations without a local key', () => {
        const compiler = new QueryCompiler(
            {
                ...mockMeta,
                relations: {
                    organization: {
                        kind: 'belongsTo',
                        table: 'organizations',
                        alias: 'org',
                        targetPk: 'id',
                    },
                },
            },
            'postgres'
        );

        expect(() => compiler.compile({ selectRelated: ['organization'] })).toThrow(/requires a local key/i);
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
