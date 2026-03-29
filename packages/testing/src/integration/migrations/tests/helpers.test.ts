import { describe, expect, it, vi } from 'vitest';
import { applyAndVerifyMigrations } from '../ApplyAndVerifyMigrations';
import { assertMigrationPlan } from '../AssertMigrationPlan';
import { introspectSchema } from '../IntrospectSchema';
import { Dialect, ResetMode, type IntegrationHarness } from '../../domain';

const { introspectMock } = vi.hoisted(() => ({
    introspectMock: vi.fn(),
}));

vi.mock('@danceroutine/tango-migrations', async () => {
    const actual = await vi.importActual<typeof import('@danceroutine/tango-migrations')>(
        '@danceroutine/tango-migrations'
    );
    return {
        ...actual,
        createDefaultIntrospectorStrategy: () => ({
            introspect: introspectMock,
        }),
    };
});

function harnessWithRunner(options?: {
    statuses?: Array<{ id: string; applied: boolean }>;
    plan?: string;
}): IntegrationHarness {
    const apply = vi.fn(async () => {});
    const status = vi.fn(async () => options?.statuses ?? []);
    const plan = vi.fn(async () => options?.plan ?? 'CREATE TABLE users');
    const runnerFactory = vi.fn(() => ({ apply, status, plan }));
    return {
        dialect: Dialect.Sqlite,
        capabilities: {
            transactionalDDL: true,
            supportsSchemas: false,
            supportsConcurrentIndex: false,
            supportsDeferredFkValidation: false,
            supportsJsonb: false,
        },
        resetMode: ResetMode.DropSchema,
        dbClient: {
            query: vi.fn(async () => ({ rows: [] })),
            begin: vi.fn(async () => {}),
            commit: vi.fn(async () => {}),
            rollback: vi.fn(async () => {}),
            close: vi.fn(async () => {}),
        },
        setup: vi.fn(async () => {}),
        reset: vi.fn(async () => {}),
        teardown: vi.fn(async () => {}),
        migrationRunner: runnerFactory,
    } as unknown as IntegrationHarness;
}

describe('migration helpers', () => {
    it('applyAndVerifyMigrations applies and checks expected ids', async () => {
        const harness = harnessWithRunner({
            statuses: [
                { id: '001', applied: true },
                { id: '002', applied: false },
            ],
        });

        const result = await applyAndVerifyMigrations(harness, {
            migrationsDir: '/tmp/migrations',
            toId: '001',
            expectedAppliedIds: ['001'],
        });

        expect(result.statuses).toHaveLength(2);
    });

    it('applyAndVerifyMigrations throws for missing expected applied ids', async () => {
        const harness = harnessWithRunner({
            statuses: [{ id: '001', applied: false }],
        });

        await expect(
            applyAndVerifyMigrations(harness, {
                migrationsDir: '/tmp/migrations',
                expectedAppliedIds: ['001'],
            })
        ).rejects.toThrow('Expected migration 001 to be applied');
    });

    it('applyAndVerifyMigrations works with no expected ids list', async () => {
        const harness = harnessWithRunner({
            statuses: [{ id: '001', applied: false }],
        });
        await expect(
            applyAndVerifyMigrations(harness, {
                migrationsDir: '/tmp/migrations',
            })
        ).resolves.toEqual({ statuses: [{ id: '001', applied: false }] });
    });

    it('assertMigrationPlan validates SQL snippets', async () => {
        const harness = harnessWithRunner({ plan: 'CREATE TABLE users; CREATE INDEX users_idx;' });
        const plan = await assertMigrationPlan(harness, {
            migrationsDir: '/tmp/migrations',
            expectSqlContains: ['CREATE TABLE users'],
        });
        expect(plan).toContain('CREATE INDEX users_idx');
    });

    it('assertMigrationPlan throws when expected snippet is missing', async () => {
        const harness = harnessWithRunner({ plan: 'CREATE TABLE users;' });
        await expect(
            assertMigrationPlan(harness, {
                migrationsDir: '/tmp/migrations',
                expectSqlContains: ['DROP TABLE users'],
            })
        ).rejects.toThrow('Expected migration plan to contain: DROP TABLE users');
    });

    it('assertMigrationPlan returns plan when no snippets are requested', async () => {
        const harness = harnessWithRunner({ plan: 'CREATE TABLE users;' });
        await expect(assertMigrationPlan(harness, { migrationsDir: '/tmp/migrations' })).resolves.toBe(
            'CREATE TABLE users;'
        );
    });
});

describe(introspectSchema, () => {
    it('introspects supported dialects and rejects unknown ones', async () => {
        introspectMock.mockResolvedValue({ tables: [] });
        // const { introspectSchema } = await import('../IntrospectSchema');

        const postgresHarness = harnessWithRunner();
        (postgresHarness as { dialect: Dialect | string }).dialect = Dialect.Postgres;
        await expect(introspectSchema(postgresHarness)).resolves.toEqual({ tables: [] });

        const sqliteHarness = harnessWithRunner();
        (sqliteHarness as { dialect: Dialect | string }).dialect = Dialect.Sqlite;
        await expect(introspectSchema(sqliteHarness)).resolves.toEqual({ tables: [] });

        const unknownHarness = harnessWithRunner();
        (unknownHarness as { dialect: Dialect | string }).dialect = 'mysql';
        await expect(introspectSchema(unknownHarness)).rejects.toThrow('No introspector registered for dialect: mysql');
    });
});
