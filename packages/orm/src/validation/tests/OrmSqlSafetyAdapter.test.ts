import { describe, expect, it } from 'vitest';
import { SqlSafetyEngine, validateSqlIdentifier } from '@danceroutine/tango-core';
import type { TableMeta } from '../../query/domain/TableMeta';
import { OrmSqlSafetyAdapter } from '../OrmSqlSafetyAdapter';
import { sqlInjectionRejectCases, type SqlInjectionCase } from './sqlInjectionCorpus';

const sqlSafetyAdapter = new OrmSqlSafetyAdapter();

const sqlSafetyTestMeta: TableMeta = {
    table: 'users',
    pk: 'id',
    columns: {
        id: 'text',
        organization_id: 'text',
        email: 'text',
        name: 'text',
    },
    relations: {
        organization: {
            kind: 'belongsTo',
            table: 'organizations',
            sourceKey: 'organization_id',
            targetKey: 'id',
            targetColumns: { id: 'text', name: 'text' },
            alias: 'organizations',
        },
    },
};

function buildRejectValidationPlan(testCase: SqlInjectionCase) {
    switch (testCase.applicablePosition) {
        case 'identifier':
            return {
                kind: 'select' as const,
                meta: {
                    ...sqlSafetyTestMeta,
                    table: testCase.payload,
                },
            };
        case 'order':
            return {
                kind: 'select' as const,
                meta: sqlSafetyTestMeta,
                orderFields: [testCase.payload],
            };
        case 'relation':
            return {
                kind: 'select' as const,
                meta: {
                    ...sqlSafetyTestMeta,
                    relations: {
                        organization: {
                            kind: 'belongsTo' as const,
                            table: testCase.payload,
                            sourceKey: 'organization_id',
                            targetKey: 'id',
                            targetColumns: { id: 'text', name: 'text' },
                            alias: 'organizations',
                        },
                    },
                },
                relationNames: ['organization'],
            };
        case 'lookup_key':
            return {
                kind: 'select' as const,
                meta: sqlSafetyTestMeta,
                filterKeys: [`email__${testCase.payload}`],
            };
        case 'value':
            throw new Error(`Cannot build a reject plan from value-position case '${testCase.id}'.`);
    }
}

type SafeValidationCase = {
    id: string;
    assert: () => void;
};

const safeValidationCases: SafeValidationCase[] = [
    {
        id: 'accepts a safe table identifier',
        assert: () => {
            const result = sqlSafetyAdapter.validate({
                kind: 'delete',
                meta: sqlSafetyTestMeta,
            });
            expect(result.kind).toBe('delete');
            expect(result.meta.table).toBe('users');
        },
    },
    {
        id: 'accepts a safe order field',
        assert: () => {
            const result = sqlSafetyAdapter.validate({
                kind: 'select',
                meta: sqlSafetyTestMeta,
                orderFields: ['email'],
            });
            expect(result.kind).toBe('select');
            expect(result.orderFields.email).toBe('users.email');
        },
    },
    {
        id: 'accepts a safe relation table',
        assert: () => {
            const result = sqlSafetyAdapter.validate({
                kind: 'select',
                meta: sqlSafetyTestMeta,
                relationNames: ['organization'],
            });
            expect(result.kind).toBe('select');
            expect(result.relations.organization?.table).toBe('organizations');
        },
    },
    {
        id: 'accepts a safe lookup key',
        assert: () => {
            const result = sqlSafetyAdapter.validate({
                kind: 'select',
                meta: sqlSafetyTestMeta,
                filterKeys: ['email__icontains'],
            });
            expect(result.kind).toBe('select');
            expect(result.filterKeys.email__icontains?.lookup).toBe('icontains');
        },
    },
];

describe(OrmSqlSafetyAdapter, () => {
    it('accepts known safe identifiers and resolves qualified columns', () => {
        const result = sqlSafetyAdapter.validate({
            kind: 'select',
            meta: sqlSafetyTestMeta,
            selectFields: ['email', 'name'],
            filterKeys: ['email__icontains'],
            orderFields: ['name'],
            relationNames: ['organization'],
        });

        expect(result.meta.table).toBe('users');
        expect(result.meta.pk).toBe('id');
        expect(result.selectFields.email).toBe('users.email');
        expect(result.filterKeys.email__icontains).toEqual({
            rawKey: 'email__icontains',
            field: 'email',
            lookup: 'icontains',
            qualifiedColumn: 'users.email',
        });
        expect(result.orderFields.name).toBe('users.name');
        expect(result.relations.organization!.table).toBe('organizations');
    });

    it('accepts select plans that omit optional relation and order fields entirely', () => {
        const result = sqlSafetyAdapter.validate({
            kind: 'select',
            meta: sqlSafetyTestMeta,
            filterKeys: ['email'],
        });

        expect(result.filterKeys.email!.lookup).toBe('exact');
        expect(result.relations).toEqual({});
        expect(result.orderFields).toEqual({});
    });

    it('rejects unknown but syntactically valid columns', () => {
        expect(() =>
            sqlSafetyAdapter.validate({
                kind: 'insert',
                meta: sqlSafetyTestMeta,
                writeKeys: ['nickname'],
            })
        ).toThrow(/unknown column/i);
    });

    it('rejects primary keys that are missing from the declared columns', () => {
        expect(() =>
            sqlSafetyAdapter.validate({
                kind: 'delete',
                meta: {
                    ...sqlSafetyTestMeta,
                    pk: 'missing_id',
                },
            })
        ).toThrow(/unknown sql primary key/i);
    });

    it('rejects repository metadata when a custom engine returns a primary key outside the validated columns', () => {
        class InconsistentSqlSafetyEngine extends SqlSafetyEngine {
            override validate() {
                return {
                    identifiers: {
                        table: validateSqlIdentifier('users', 'table'),
                        pk: validateSqlIdentifier('missing_id', 'primaryKey'),
                        'column:id': validateSqlIdentifier('id', 'column'),
                        'column:organization_id': validateSqlIdentifier('organization_id', 'column'),
                        'column:email': validateSqlIdentifier('email', 'column'),
                        'column:name': validateSqlIdentifier('name', 'column'),
                    },
                    lookupTokens: {},
                    rawFragments: {},
                };
            }
        }

        const adapter = new OrmSqlSafetyAdapter(new InconsistentSqlSafetyEngine());

        expect(() =>
            adapter.validate({
                kind: 'delete',
                meta: sqlSafetyTestMeta,
            })
        ).toThrow(/unknown column 'missing_id'/i);
    });

    it('rejects unknown relations requested by the caller', () => {
        expect(() =>
            sqlSafetyAdapter.validate({
                kind: 'select',
                meta: sqlSafetyTestMeta,
                relationNames: ['missing'],
            })
        ).toThrow(/unknown relation 'missing'/i);
    });

    it('rejects lookup keys with more than one lookup separator', () => {
        expect(() =>
            sqlSafetyAdapter.validate({
                kind: 'select',
                meta: sqlSafetyTestMeta,
                filterKeys: ['email__icontains__extra'],
            })
        ).toThrow(/invalid sql lookup key/i);
    });

    it('rejects relations without a validated source key', () => {
        expect(() =>
            sqlSafetyAdapter.validate({
                kind: 'select',
                meta: {
                    ...sqlSafetyTestMeta,
                    relations: {
                        organization: {
                            kind: 'belongsTo',
                            table: 'organizations',
                            alias: 'organizations',
                            sourceKey: 'missing_local_key',
                            targetKey: 'id',
                            targetColumns: { id: 'text' },
                        },
                    },
                },
                relationNames: ['organization'],
            })
        ).toThrow(/unknown column 'missing_local_key'/i);
    });

    it('rejects direct relation resolution for unknown validated relation names', () => {
        expect(() =>
            (
                sqlSafetyAdapter as unknown as {
                    resolveRelation: (
                        meta: { table: string; relations?: Record<string, unknown> },
                        relation: string
                    ) => unknown;
                }
            ).resolveRelation(
                {
                    table: 'users',
                    relations: {},
                },
                'missing'
            )
        ).toThrow(/unknown relation 'missing'/i);
    });

    it('validates relation target keys when present', () => {
        const result = sqlSafetyAdapter.validate({
            kind: 'select',
            meta: {
                ...sqlSafetyTestMeta,
                relations: {
                    memberships: {
                        kind: 'hasMany',
                        table: 'memberships',
                        alias: 'memberships',
                        sourceKey: 'id',
                        targetKey: 'user_id',
                        targetColumns: { id: 'text', user_id: 'text' },
                    },
                },
            },
            relationNames: ['memberships'],
        });

        expect(result.relations.memberships!.targetKey).toBe('user_id');
    });

    it.each(safeValidationCases)('$id', ({ assert }) => {
        assert();
    });

    it.each(sqlInjectionRejectCases)('$id rejects $applicablePosition payloads from $source', (testCase) => {
        expect(() => sqlSafetyAdapter.validate(buildRejectValidationPlan(testCase))).toThrow();
    });
});
