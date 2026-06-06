import { describe, expect, it } from 'vitest';
import { anAdapter, aRelationMeta } from '@danceroutine/tango-testing';
import { Q } from '../..';
import { WhereCompiler } from '../WhereCompiler';
import type { Adapter } from '../../../connection';
import { OrmSqlSafetyAdapter } from '../../../validation';
import { InternalSqlValidationPlanKind as SqlPlanKind } from '../../../validation/internal/InternalSqlValidationPlanKind';
import { InternalValidatedFilterDescriptorKind } from '../../../validation/internal/InternalValidatedFilterDescriptorKind';
import type { ValidatedFilterDescriptor } from '../../../validation/SQLValidationEngine';
import type { QNode } from '../../domain/QNode';
import type { TableMeta } from '../../domain/TableMeta';
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
const sqlSafetyAdapter = new OrmSqlSafetyAdapter();

function compileWhere<T>(
    q: QNode<T>,
    options: { meta?: TableMeta; adapter?: Adapter; paramIndex?: number } = {}
): { sql: string; params: readonly unknown[] } {
    const meta = options.meta ?? mockMeta;
    const adapter = options.adapter ?? postgresAdapter;
    const compiler = new WhereCompiler(meta, adapter);
    const validatedPlan = sqlSafetyAdapter.validate({
        kind: SqlPlanKind.SELECT,
        meta,
        filterKeys: compiler.collectStateFilterKeys({ q }),
        relationNames: [],
    });

    return compiler.compileNode(q, options.paramIndex ?? 1, validatedPlan.filterKeys);
}

describe(WhereCompiler, () => {
    it('collects filter keys from root predicates and excludes', () => {
        const compiler = new WhereCompiler(mockMeta, postgresAdapter);

        expect(
            compiler.collectStateFilterKeys<UserModel>({
                q: Q.and({ email: 'test@example.com' }, { age__gte: 18 }),
                excludes: [Q.not({ name__contains: 'bot' })],
            })
        ).toEqual(['email', 'age__gte', 'name__contains']);
    });

    it('compiles exact filters', () => {
        const result = compileWhere<UserModel>({ kind: 'atom', where: { email: 'test@example.com' } });

        expect(result.sql).toContain('users.email = $1');
        expect(result.params).toEqual(['test@example.com']);
    });

    it('compiles null values as IS NULL', () => {
        const result = compileWhere<UserModel>({ kind: 'atom', where: { email: null } });

        expect(result.sql).toContain('users.email IS NULL');
        expect(result.params).toEqual([]);
    });

    it('compiles comparison lookups', () => {
        const result = compileWhere<UserModel>(
            Q.and({ age__lt: 30 }, { age__lte: 65 }, { age__gt: 21 }, { age__gte: 18 })
        );

        expect(result.sql).toContain('users.age < $1');
        expect(result.sql).toContain('users.age <= $2');
        expect(result.sql).toContain('users.age > $3');
        expect(result.sql).toContain('users.age >= $4');
        expect(result.params).toEqual([30, 65, 21, 18]);
    });

    it('compiles IN lookups and treats empty IN lookups as always false', () => {
        const populated = compileWhere<UserModel>({ kind: 'atom', where: { id__in: [1, 2, 3] } });
        const empty = compileWhere<UserModel>({ kind: 'atom', where: { id__in: [] } });

        expect(populated.sql).toContain('users.id IN ($1, $2, $3)');
        expect(populated.params).toEqual([1, 2, 3]);
        expect(empty.sql).toContain('1=0');
        expect(empty.params).toEqual([]);
    });

    it('compiles IS NULL lookups', () => {
        const isNull = compileWhere<UserModel>({ kind: 'atom', where: { email__isnull: true } });
        const isNotNull = compileWhere<UserModel>({ kind: 'atom', where: { email__isnull: false } });

        expect(isNull.sql).toContain('users.email IS NULL');
        expect(isNotNull.sql).toContain('users.email IS NOT NULL');
    });

    it('compiles string lookups', () => {
        const contains = compileWhere<UserModel>({ kind: 'atom', where: { name__contains: 'John' } });
        const startsWith = compileWhere<UserModel>({ kind: 'atom', where: { email__startswith: 'admin' } });
        const endsWith = compileWhere<UserModel>({ kind: 'atom', where: { email__endswith: '.com' } });

        expect(contains.sql).toContain('users.name LIKE $1');
        expect(contains.params).toEqual(['%John%']);
        expect(startsWith.sql).toContain('users.email LIKE $1');
        expect(startsWith.params).toEqual(['admin%']);
        expect(endsWith.sql).toContain('users.email LIKE $1');
        expect(endsWith.params).toEqual(['%.com']);
    });

    it('compiles case-insensitive string lookups for PostgreSQL', () => {
        const contains = compileWhere<UserModel>({ kind: 'atom', where: { name__icontains: 'JOHN' } });
        const startsWith = compileWhere<UserModel>({ kind: 'atom', where: { email__istartswith: 'ADMIN' } });
        const endsWith = compileWhere<UserModel>({ kind: 'atom', where: { email__iendswith: '.COM' } });

        expect(contains.sql).toContain('LOWER(users.name) LIKE $1');
        expect(contains.params).toEqual(['%john%']);
        expect(startsWith.sql).toContain('LOWER(users.email) LIKE $1');
        expect(startsWith.params).toEqual(['admin%']);
        expect(endsWith.sql).toContain('LOWER(users.email) LIKE $1');
        expect(endsWith.params).toEqual(['%.com']);
    });

    it('compiles AND, OR, and NOT nodes', () => {
        const andResult = compileWhere<UserModel>(Q.and({ email: 'test@example.com' }, { age__gte: 18 }));
        const orResult = compileWhere<UserModel>(Q.or({ email: 'test@example.com' }, { email: 'admin@example.com' }));
        const notResult = compileWhere<UserModel>(Q.not({ email: 'test@example.com' }));

        expect(andResult.sql).toContain('users.email = $1');
        expect(andResult.sql).toContain('users.age >= $2');
        expect(andResult.sql).toContain('AND');
        expect(andResult.params).toEqual(['test@example.com', 18]);
        expect(orResult.sql).toContain('users.email = $1');
        expect(orResult.sql).toContain('users.email = $2');
        expect(orResult.sql).toContain('OR');
        expect(orResult.params).toEqual(['test@example.com', 'admin@example.com']);
        expect(notResult.sql).toContain('NOT');
        expect(notResult.sql).toContain('users.email = $1');
        expect(notResult.params).toEqual(['test@example.com']);
    });

    it('elides empty predicates', () => {
        const compiler = new WhereCompiler(mockMeta, postgresAdapter);
        const validatedPlan = sqlSafetyAdapter.validate({
            kind: SqlPlanKind.SELECT,
            meta: mockMeta,
            filterKeys: ['email', 'id'],
            relationNames: [],
        });
        const notResult = compiler.compileNode(Q.not<UserModel>({ email: undefined }), 1, validatedPlan.filterKeys);
        const andResult = compiler.compileNode<UserModel>(
            {
                kind: 'and',
                nodes: [
                    { kind: 'atom', where: { email: undefined } },
                    { kind: 'atom', where: { id: 1 } },
                ],
            },
            1,
            validatedPlan.filterKeys
        );
        const orResult = compiler.compileNode<UserModel>(
            {
                kind: 'or',
                nodes: [
                    { kind: 'atom', where: { email: undefined } },
                    { kind: 'atom', where: { id: 2 } },
                ],
            },
            1,
            validatedPlan.filterKeys
        );
        const emptyAnd = compiler.compileNode<UserModel>(
            { kind: 'and', nodes: [{ kind: 'atom', where: { email: undefined } }] },
            1,
            validatedPlan.filterKeys
        );
        const emptyOr = compiler.compileNode<UserModel>(
            { kind: 'or', nodes: [{ kind: 'atom', where: { email: undefined } }] },
            1,
            validatedPlan.filterKeys
        );

        expect(notResult.sql).toBe('');
        expect(andResult.sql).toContain('users.id = $1');
        expect(andResult.params).toEqual([1]);
        expect(orResult.sql).toContain('users.id = $1');
        expect(orResult.params).toEqual([2]);
        expect(emptyAnd.sql).toBe('');
        expect(emptyOr.sql).toBe('');
    });

    it('handles missing predicate payload arrays and objects as empty predicates', () => {
        const compiler = new WhereCompiler(mockMeta, postgresAdapter);

        expect(compiler.compileNode({ kind: 'and' }, 1, {}).sql).toBe('');
        expect(compiler.compileNode({ kind: 'or' }, 1, {}).sql).toBe('');
        expect(compiler.compileNode({ kind: 'atom' }, 1, {}).sql).toBe('');
    });

    it('ignores q-nodes with unknown kinds', () => {
        const result = compileWhere({
            kind: 'unknown_kind' as unknown as 'atom',
        });

        expect(result).toEqual({ sql: '', params: [] });
    });

    it('defensively rejects unsupported lookup values during SQL rendering', () => {
        const compiler = new WhereCompiler(mockMeta, postgresAdapter);
        const filterKeys = {
            email__wat: {
                kind: InternalValidatedFilterDescriptorKind.COLUMN,
                rawKey: 'email__wat',
                field: 'email',
                lookup: 'wat',
                qualifiedColumn: 'users.email',
            },
        } as unknown as Record<string, ValidatedFilterDescriptor>;

        expect(() => compiler.compileNode({ kind: 'atom', where: { email__wat: 'payload' } }, 1, filterKeys)).toThrow(
            'Unknown lookup: wat'
        );
    });

    it('uses SQLite placeholders and normalized boolean parameters', () => {
        const result = compileWhere<UserModel>(Q.and({ isActive: true }, { id__in: 9 }), {
            adapter: sqliteAdapter,
        });
        const falseResult = compileWhere<UserModel>(
            { kind: 'atom', where: { isActive: false } },
            {
                adapter: sqliteAdapter,
            }
        );

        expect(result.sql).toContain('users.isActive = ?');
        expect(result.sql).toContain('users.id IN (?)');
        expect(result.params).toEqual([1, 9]);
        expect(falseResult.params).toEqual([0]);
    });

    it('uses SQLite column casing for case-insensitive lookups', () => {
        const contains = compileWhere<UserModel>(
            { kind: 'atom', where: { email__icontains: 'ADMIN' } },
            {
                adapter: sqliteAdapter,
            }
        );
        const startsWith = compileWhere<UserModel>(
            { kind: 'atom', where: { email__istartswith: 'ADMIN' } },
            {
                adapter: sqliteAdapter,
            }
        );
        const endsWith = compileWhere<UserModel>(
            { kind: 'atom', where: { email__iendswith: '.COM' } },
            {
                adapter: sqliteAdapter,
            }
        );

        expect(contains.sql).toContain('users.email LIKE ?');
        expect(contains.params).toEqual(['%admin%']);
        expect(startsWith.sql).toContain('users.email LIKE ?');
        expect(startsWith.params).toEqual(['admin%']);
        expect(endsWith.sql).toContain('users.email LIKE ?');
        expect(endsWith.params).toEqual(['%.com']);
    });

    it('compiles single-valued relation-path filters through correlated EXISTS clauses', () => {
        const meta: TableMeta = {
            ...mockMeta,
            relations: {
                organization: aRelationMeta({
                    kind: InternalRelationKind.BELONGS_TO,
                    table: 'organizations',
                    sourceKey: 'organization_id',
                    targetKey: 'id',
                    targetPrimaryKey: 'id',
                    targetColumns: { id: 'int', name: 'text' },
                    alias: 'organizations',
                    targetMeta: {
                        table: 'organizations',
                        pk: 'id',
                        columns: { id: 'int', name: 'text' },
                    },
                }),
            },
        };

        const result = compileWhere({ kind: 'atom', where: { organization__name__icontains: 'dance' } }, { meta });

        expect(result.sql).toContain('EXISTS (SELECT 1 FROM organizations');
        expect(result.sql).toContain('LOWER(__tango_filter_organization_target_organizations_0.name) LIKE $1');
        expect(result.params).toEqual(['%dance%']);
    });

    it('rejects relation-filter aliases that collide with model fields', () => {
        const meta: TableMeta = {
            ...mockMeta,
            columns: {
                ...mockMeta.columns,
                __tango_filter_organization_target_organizations_0: 'text',
            },
            relations: {
                organization: aRelationMeta({
                    kind: InternalRelationKind.BELONGS_TO,
                    table: 'organizations',
                    sourceKey: 'organization_id',
                    targetKey: 'id',
                    targetPrimaryKey: 'id',
                    targetColumns: { id: 'int', name: 'text' },
                    alias: 'organizations',
                    targetMeta: {
                        table: 'organizations',
                        pk: 'id',
                        columns: { id: 'int', name: 'text' },
                    },
                }),
            },
        };

        expect(() => compileWhere({ kind: 'atom', where: { organization__name: 'dance' } }, { meta })).toThrow(
            /internal query alias/i
        );
    });

    it('compiles nested single-valued relation-path filters through chained correlated EXISTS clauses', () => {
        const meta: TableMeta = {
            ...mockMeta,
            relations: {
                organization: aRelationMeta({
                    kind: InternalRelationKind.BELONGS_TO,
                    table: 'organizations',
                    sourceKey: 'organization_id',
                    targetKey: 'id',
                    targetPrimaryKey: 'id',
                    targetColumns: { id: 'int', parent_id: 'int', name: 'text' },
                    alias: 'organizations',
                    targetMeta: {
                        table: 'organizations',
                        pk: 'id',
                        columns: { id: 'int', parent_id: 'int', name: 'text' },
                        relations: {
                            parent: aRelationMeta({
                                kind: InternalRelationKind.BELONGS_TO,
                                table: 'organizations',
                                sourceKey: 'parent_id',
                                targetKey: 'id',
                                targetPrimaryKey: 'id',
                                targetColumns: { id: 'int', name: 'text' },
                                alias: 'parent',
                                targetMeta: {
                                    table: 'organizations',
                                    pk: 'id',
                                    columns: { id: 'int', name: 'text' },
                                },
                            }),
                        },
                    },
                }),
            },
        };

        const result = compileWhere(
            { kind: 'atom', where: { organization__parent__name__icontains: 'core' } },
            { meta }
        );

        expect(result.sql).toContain(
            'EXISTS (SELECT 1 FROM organizations __tango_filter_organization_parent_target_organizations_1'
        );
        expect(result.sql).toContain(
            'EXISTS (SELECT 1 FROM organizations __tango_filter_organization_parent_target_parent_0'
        );
        expect(result.sql).toContain('LOWER(__tango_filter_organization_parent_target_parent_0.name) LIKE $1');
        expect(result.params).toEqual(['%core%']);
    });

    it('compiles many-to-many relation-path filters through correlated EXISTS clauses', () => {
        const meta: TableMeta = {
            table: 'posts',
            pk: 'id',
            columns: {
                id: 'int',
                title: 'text',
            },
            relations: {
                tags: {
                    kind: InternalRelationKind.MANY_TO_MANY,
                    edgeId: 'posts:tags',
                    sourceModelKey: 'tests/Post',
                    targetModelKey: 'tests/Tag',
                    cardinality: 'many',
                    capabilities: {
                        queryable: true,
                        hydratable: true,
                        joinable: false,
                        prefetchable: true,
                    },
                    table: 'tags',
                    sourceKey: 'id',
                    targetKey: 'id',
                    throughTable: 'post_tags',
                    throughSourceKey: 'post_id',
                    throughTargetKey: 'tag_id',
                    targetPrimaryKey: 'id',
                    targetColumns: { id: 'int', slug: 'text' },
                    alias: 'tags',
                    targetMeta: {
                        table: 'tags',
                        pk: 'id',
                        columns: { id: 'int', slug: 'text' },
                    },
                },
            },
        };

        const result = compileWhere({ kind: 'atom', where: { tags__slug: 'tango' } }, { meta });

        expect(result.sql).toContain('EXISTS (SELECT 1 FROM post_tags');
        expect(result.sql).toContain('INNER JOIN tags');
        expect(result.sql).toContain('__tango_filter_tags_target_tags_0.slug = $1');
        expect(result.params).toEqual(['tango']);
    });

    it('throws when relation-filter compilation is asked to traverse an empty relation chain', () => {
        const compiler = new WhereCompiler(mockMeta, postgresAdapter);
        const filterKeys = {
            organization__name: {
                kind: InternalValidatedFilterDescriptorKind.RELATION,
                rawKey: 'organization__name',
                field: 'name',
                lookup: 'exact',
                relationPath: 'organization',
                relationChain: [],
                terminalColumn: 'name',
            },
        } as unknown as Record<string, ValidatedFilterDescriptor>;

        expect(() =>
            compiler.compileNode({ kind: 'atom', where: { organization__name: 'pedro' } }, 1, filterKeys)
        ).toThrow(/cannot compile empty relation filter path/i);
    });
});
