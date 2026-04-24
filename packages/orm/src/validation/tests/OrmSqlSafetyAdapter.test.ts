import { describe, expect, it } from 'vitest';
import { SqlSafetyEngine, validateSqlIdentifier } from '@danceroutine/tango-core';
import { aRelationMeta } from '@danceroutine/tango-testing';
import type { TableMeta } from '../../query/domain/TableMeta';
import { InternalSqlValidationPlanKind as SqlPlanKind } from '../internal/InternalSqlValidationPlanKind';
import { OrmSqlSafetyAdapter } from '../OrmSqlSafetyAdapter';
import type { SelectSqlValidationPlan } from '../SqlValidationPlan';
import { InternalRelationKind } from '../../query/domain/internal/InternalRelationKind';
import {
    InternalSqlInjectionApplicablePosition as SqlInjectionPosition,
    sqlInjectionRejectCases,
    type SqlInjectionCase,
} from './sqlInjectionCorpus';

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
        organization: aRelationMeta({
            kind: InternalRelationKind.BELONGS_TO,
            table: 'organizations',
            sourceKey: 'organization_id',
            targetKey: 'id',
            targetColumns: { id: 'text', name: 'text' },
            alias: 'organizations',
        }),
    },
};

function buildRejectValidationPlan(testCase: SqlInjectionCase): SelectSqlValidationPlan {
    switch (testCase.applicablePosition) {
        case SqlInjectionPosition.IDENTIFIER:
            return {
                kind: SqlPlanKind.SELECT,
                meta: {
                    ...sqlSafetyTestMeta,
                    table: testCase.payload,
                },
            };
        case SqlInjectionPosition.ORDER:
            return {
                kind: SqlPlanKind.SELECT,
                meta: sqlSafetyTestMeta,
                orderFields: [testCase.payload],
            };
        case SqlInjectionPosition.RELATION:
            return {
                kind: SqlPlanKind.SELECT,
                meta: {
                    ...sqlSafetyTestMeta,
                    relations: {
                        organization: aRelationMeta({
                            kind: InternalRelationKind.BELONGS_TO,
                            table: testCase.payload,
                            sourceKey: 'organization_id',
                            targetKey: 'id',
                            targetColumns: { id: 'text', name: 'text' },
                            alias: 'organizations',
                        }),
                    },
                },
                relationNames: ['organization'],
            };
        case SqlInjectionPosition.LOOKUP_KEY:
            return {
                kind: SqlPlanKind.SELECT,
                meta: sqlSafetyTestMeta,
                filterKeys: [`email__${testCase.payload}`],
            };
        case SqlInjectionPosition.VALUE:
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
                kind: SqlPlanKind.DELETE,
                meta: sqlSafetyTestMeta,
            });
            expect(result.kind).toBe(SqlPlanKind.DELETE);
            expect(result.meta.table).toBe('users');
        },
    },
    {
        id: 'accepts a safe order field',
        assert: () => {
            const result = sqlSafetyAdapter.validate({
                kind: SqlPlanKind.SELECT,
                meta: sqlSafetyTestMeta,
                orderFields: ['email'],
            });
            expect(result.kind).toBe(SqlPlanKind.SELECT);
            expect(result.orderFields.email).toBe('users.email');
        },
    },
    {
        id: 'accepts a safe relation table',
        assert: () => {
            const result = sqlSafetyAdapter.validate({
                kind: SqlPlanKind.SELECT,
                meta: sqlSafetyTestMeta,
                relationNames: ['organization'],
            });
            expect(result.kind).toBe(SqlPlanKind.SELECT);
            expect(result.relations.organization?.table).toBe('organizations');
        },
    },
    {
        id: 'accepts a safe lookup key',
        assert: () => {
            const result = sqlSafetyAdapter.validate({
                kind: SqlPlanKind.SELECT,
                meta: sqlSafetyTestMeta,
                filterKeys: ['email__icontains'],
            });
            expect(result.kind).toBe(SqlPlanKind.SELECT);
            expect(result.filterKeys.email__icontains?.lookup).toBe('icontains');
        },
    },
];

describe(OrmSqlSafetyAdapter, () => {
    it('accepts known safe identifiers and resolves qualified columns', () => {
        const result = sqlSafetyAdapter.validate({
            kind: SqlPlanKind.SELECT,
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
            kind: 'column',
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
            kind: SqlPlanKind.SELECT,
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
                kind: SqlPlanKind.INSERT,
                meta: sqlSafetyTestMeta,
                writeKeys: ['nickname'],
            })
        ).toThrow(/unknown column/i);
    });

    it('rejects primary keys that are missing from the declared columns', () => {
        expect(() =>
            sqlSafetyAdapter.validate({
                kind: SqlPlanKind.DELETE,
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
                kind: SqlPlanKind.DELETE,
                meta: sqlSafetyTestMeta,
            })
        ).toThrow(/unknown column 'missing_id'/i);
    });

    it('rejects unknown relations requested by the caller', () => {
        expect(() =>
            sqlSafetyAdapter.validate({
                kind: SqlPlanKind.SELECT,
                meta: sqlSafetyTestMeta,
                relationNames: ['missing'],
            })
        ).toThrow(/unknown relation 'missing'/i);
    });

    it('rejects lookup keys with more than one lookup separator', () => {
        expect(() =>
            sqlSafetyAdapter.validate({
                kind: SqlPlanKind.SELECT,
                meta: sqlSafetyTestMeta,
                filterKeys: ['email__icontains__extra'],
            })
        ).toThrow(/invalid sql lookup key/i);
    });

    it('rejects malformed relation lookup keys and invalid relation metadata during nested filter validation', () => {
        expect(() =>
            sqlSafetyAdapter.validate({
                kind: SqlPlanKind.SELECT,
                meta: sqlSafetyTestMeta,
                filterKeys: ['icontains'],
            })
        ).toThrow(/invalid sql lookup key/i);

        expect(() =>
            sqlSafetyAdapter.validate({
                kind: SqlPlanKind.SELECT,
                meta: sqlSafetyTestMeta,
                filterKeys: ['email____icontains'],
            })
        ).toThrow(/invalid sql lookup key/i);

        expect(() =>
            sqlSafetyAdapter.validate({
                kind: SqlPlanKind.SELECT,
                meta: {
                    ...sqlSafetyTestMeta,
                    relations: {
                        organization: aRelationMeta({
                            kind: InternalRelationKind.BELONGS_TO,
                            table: 'organizations',
                            sourceKey: 'organization_id',
                            targetKey: 'id',
                            targetColumns: { id: 'text', name: 'text' },
                            alias: 'organizations',
                        }),
                    },
                },
                filterKeys: ['organization__exact'],
            })
        ).toThrow(/unknown column 'organization'/i);

        expect(() =>
            sqlSafetyAdapter.validate({
                kind: SqlPlanKind.SELECT,
                meta: sqlSafetyTestMeta,
                filterKeys: ['missing__name__icontains'],
            })
        ).toThrow(/unknown relation 'missing'/i);

        expect(() =>
            sqlSafetyAdapter.validate({
                kind: SqlPlanKind.SELECT,
                meta: {
                    ...sqlSafetyTestMeta,
                    relations: {
                        organization: {
                            kind: InternalRelationKind.BELONGS_TO,
                            table: 'organizations',
                            sourceKey: 'organization_id',
                            targetKey: 'id',
                            targetPrimaryKey: 'id',
                            targetColumns: { id: 'text', name: 'text' },
                            alias: 'organizations',
                            targetMeta: undefined,
                        } as unknown as NonNullable<TableMeta['relations']>[string],
                    },
                },
                filterKeys: ['organization__name__icontains'],
            })
        ).toThrow(/missing target metadata/i);
    });

    it('validates relation-path filters against nested relation metadata', () => {
        const result = sqlSafetyAdapter.validate({
            kind: SqlPlanKind.SELECT,
            meta: {
                ...sqlSafetyTestMeta,
                relations: {
                    organization: aRelationMeta({
                        kind: InternalRelationKind.BELONGS_TO,
                        table: 'organizations',
                        sourceKey: 'organization_id',
                        targetKey: 'id',
                        targetPrimaryKey: 'id',
                        targetColumns: { id: 'text', name: 'text' },
                        alias: 'organizations',
                        targetMeta: {
                            table: 'organizations',
                            pk: 'id',
                            columns: { id: 'text', name: 'text' },
                        },
                    }),
                },
            },
            filterKeys: ['organization__name__icontains'],
        });

        expect(result.filterKeys.organization__name__icontains).toEqual({
            kind: 'relation',
            rawKey: 'organization__name__icontains',
            field: 'name',
            lookup: 'icontains',
            relationPath: 'organization',
            relationChain: [
                expect.objectContaining({
                    table: 'organizations',
                    sourceKey: 'organization_id',
                    targetKey: 'id',
                }),
            ],
            terminalColumn: 'name',
        });
    });

    it('rejects relations without a validated source key', () => {
        expect(() =>
            sqlSafetyAdapter.validate({
                kind: SqlPlanKind.SELECT,
                meta: {
                    ...sqlSafetyTestMeta,
                    relations: {
                        organization: aRelationMeta({
                            kind: InternalRelationKind.BELONGS_TO,
                            table: 'organizations',
                            alias: 'organizations',
                            sourceKey: 'missing_local_key',
                            targetKey: 'id',
                            targetColumns: { id: 'text' },
                        }),
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
            kind: SqlPlanKind.SELECT,
            meta: {
                ...sqlSafetyTestMeta,
                relations: {
                    memberships: aRelationMeta({
                        kind: InternalRelationKind.HAS_MANY,
                        table: 'memberships',
                        alias: 'memberships',
                        sourceKey: 'id',
                        targetKey: 'user_id',
                        targetColumns: { id: 'text', user_id: 'text' },
                    }),
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
