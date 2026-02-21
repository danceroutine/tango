import { describe, expect, it, vi } from 'vitest';
import { PostgresAdapter } from '@danceroutine/tango-orm/connection';
import { Dialect, ResetMode } from '../../domain';
import { runDialectConformanceSuite } from '../../conformance';
import { PostgresHarnessStrategy } from '../PostgresHarnessStrategy';

describe(PostgresHarnessStrategy, () => {
    it('creates a postgres harness that resets by dropping the schema', async () => {
        const client = {
            query: vi.fn(async (sql: string) => ({ rows: sql ? [] : [] })),
            begin: vi.fn(async () => {}),
            commit: vi.fn(async () => {}),
            rollback: vi.fn(async () => {}),
            close: vi.fn(async () => {}),
        };
        const connectSpy = vi.spyOn(PostgresAdapter.prototype, 'connect').mockResolvedValue(client as never);

        const strategy = new PostgresHarnessStrategy();
        expect(PostgresHarnessStrategy.isPostgresHarnessStrategy(strategy)).toBe(true);
        expect(PostgresHarnessStrategy.isPostgresHarnessStrategy({})).toBe(false);

        const harness = await strategy.create({
            resetMode: ResetMode.DropSchema,
            schema: 'custom_schema',
        });

        await harness.teardown();
        expect(() => harness.dbClient).toThrow('Postgres harness not initialized');
        expect(() => harness.migrationRunner('/tmp/migrations')).toThrow('Postgres harness not initialized');
        await expect(harness.reset()).rejects.toThrow('Postgres harness not initialized');

        await harness.setup();
        expect(harness.dbClient).toBe(client);
        await harness.reset();
        const queries = client.query.mock.calls.map(([sql]) => String(sql));
        expect(queries.some((sql) => sql.includes('CREATE SCHEMA IF NOT EXISTS "custom_schema"'))).toBe(true);
        expect(queries.some((sql) => sql.includes('DROP SCHEMA IF EXISTS "custom_schema" CASCADE'))).toBe(true);
        expect(queries.some((sql) => sql.includes('SET search_path TO "custom_schema"'))).toBe(true);

        harness.migrationRunner('/tmp/migrations');
        await harness.teardown();
        expect(client.close).toHaveBeenCalled();
        connectSpy.mockRestore();
    });

    it('truncates tables when reset mode is truncate', async () => {
        const client = {
            query: vi.fn(async (sql: string) => {
                if (sql.includes('information_schema.tables')) {
                    return { rows: [{ table_name: 'users' }, { table_name: 'posts' }] };
                }
                return { rows: [] };
            }),
            begin: vi.fn(async () => {}),
            commit: vi.fn(async () => {}),
            rollback: vi.fn(async () => {}),
            close: vi.fn(async () => {}),
        };
        const connectSpy = vi.spyOn(PostgresAdapter.prototype, 'connect').mockResolvedValue(client as never);

        const harness = await new PostgresHarnessStrategy().create({
            resetMode: ResetMode.Truncate,
        });
        await harness.setup();
        await harness.reset();
        await harness.teardown();

        expect(
            client.query.mock.calls.some(
                ([sql]) =>
                    String(sql).includes('TRUNCATE TABLE "tango_test_') &&
                    String(sql).includes('"users" RESTART IDENTITY CASCADE')
            )
        ).toBe(true);
        expect(
            client.query.mock.calls.some(
                ([sql]) =>
                    String(sql).includes('TRUNCATE TABLE "tango_test_') &&
                    String(sql).includes('"posts" RESTART IDENTITY CASCADE')
            )
        ).toBe(true);
        connectSpy.mockRestore();
    });

    it('reports the postgres dialect on created harnesses', async () => {
        const client = {
            query: vi.fn(async () => ({ rows: [] })),
            begin: vi.fn(async () => {}),
            commit: vi.fn(async () => {}),
            rollback: vi.fn(async () => {}),
            close: vi.fn(async () => {}),
        };
        const connectSpy = vi.spyOn(PostgresAdapter.prototype, 'connect').mockResolvedValue(client as never);
        const harness = await new PostgresHarnessStrategy().create({
            resetMode: ResetMode.Transaction,
        });
        expect(harness.dialect).toBe(Dialect.Postgres);
        await harness.setup();
        await harness.reset();
        await harness.teardown();
        connectSpy.mockRestore();
    });

    it('satisfies the shared harness strategy contract', async () => {
        const client = {
            query: vi.fn(async () => ({ rows: [] })),
            begin: vi.fn(async () => {}),
            commit: vi.fn(async () => {}),
            rollback: vi.fn(async () => {}),
            close: vi.fn(async () => {}),
        };
        const connectSpy = vi.spyOn(PostgresAdapter.prototype, 'connect').mockResolvedValue(client as never);
        const strategy = new PostgresHarnessStrategy();
        await runDialectConformanceSuite(strategy, {
            createOptions: { resetMode: ResetMode.DropSchema, schema: 'conformance_schema' },
        });
        connectSpy.mockRestore();
    });
});
