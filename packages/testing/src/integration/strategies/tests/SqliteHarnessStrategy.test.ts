import { describe, expect, it, vi } from 'vitest';
import { SqliteAdapter } from '@danceroutine/tango-orm/connection';
import { ResetMode } from '../../domain';
import { runDialectConformanceSuite } from '../../conformance';
import { SqliteHarnessStrategy } from '../SqliteHarnessStrategy';

const { rmMock } = vi.hoisted(() => ({
    rmMock: vi.fn(async () => {}),
}));

vi.mock('node:fs/promises', () => ({
    rm: rmMock,
}));

describe(SqliteHarnessStrategy, () => {
    it('recreates a file-backed database when resetting', async () => {
        const firstClient = {
            query: vi.fn(async () => ({ rows: [] })),
            begin: vi.fn(async () => {}),
            commit: vi.fn(async () => {}),
            rollback: vi.fn(async () => {}),
            close: vi.fn(async () => {}),
        };
        const secondClient = {
            query: vi.fn(async () => ({ rows: [] })),
            begin: vi.fn(async () => {}),
            commit: vi.fn(async () => {}),
            rollback: vi.fn(async () => {}),
            close: vi.fn(async () => {}),
        };
        const connectSpy = vi
            .spyOn(SqliteAdapter.prototype, 'connect')
            .mockResolvedValueOnce(firstClient as never)
            .mockResolvedValueOnce(secondClient as never);

        const strategy = new SqliteHarnessStrategy();
        expect(SqliteHarnessStrategy.isSqliteHarnessStrategy(strategy)).toBe(true);
        expect(SqliteHarnessStrategy.isSqliteHarnessStrategy({})).toBe(false);

        const harness = await strategy.create({
            resetMode: ResetMode.DropSchema,
            sqliteFile: '/tmp/testing.sqlite',
        });

        await harness.teardown();
        expect(() => harness.dbClient).toThrow('Sqlite harness not initialized');
        expect(() => harness.migrationRunner('/tmp/migrations')).toThrow('Sqlite harness not initialized');
        await expect(harness.reset()).rejects.toThrow('Sqlite harness not initialized');

        await harness.setup();
        expect(harness.dbClient).toBe(firstClient);
        await harness.reset();
        expect(firstClient.close).toHaveBeenCalledOnce();
        expect(connectSpy).toHaveBeenCalledTimes(2);
        expect(rmMock).toHaveBeenCalledWith('/tmp/testing.sqlite', { force: true });

        const runner = harness.migrationRunner('/tmp/migrations');
        expect(runner).toBeDefined();

        await harness.teardown();
        expect(secondClient.close).toHaveBeenCalled();
        connectSpy.mockRestore();
    });

    it('clears in-memory databases by dropping their tables', async () => {
        const client = {
            query: vi.fn(async (sql: string) => {
                if (sql.includes('sqlite_master')) {
                    return { rows: [{ name: 'users' }, { name: 'posts' }] };
                }
                return { rows: [] };
            }),
            begin: vi.fn(async () => {}),
            commit: vi.fn(async () => {}),
            rollback: vi.fn(async () => {}),
            close: vi.fn(async () => {}),
        };
        const connectSpy = vi.spyOn(SqliteAdapter.prototype, 'connect').mockResolvedValue(client as never);

        // const { SqliteHarnessStrategy } = await import('../SqliteHarnessStrategy');
        const harness = await new SqliteHarnessStrategy().create({
            resetMode: ResetMode.Truncate,
            sqliteFile: ':memory:',
        });
        await harness.setup();
        expect(harness.dbClient).toBe(client);
        await harness.reset();
        await harness.teardown();

        expect(client.query).toHaveBeenCalledWith('DROP TABLE IF EXISTS "users"');
        expect(client.query).toHaveBeenCalledWith('DROP TABLE IF EXISTS "posts"');
        expect(rmMock).not.toHaveBeenCalledWith(':memory:', { force: true });

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
        const connectSpy = vi.spyOn(SqliteAdapter.prototype, 'connect').mockResolvedValue(client as never);
        // const { SqliteHarnessStrategy } = await import('../SqliteHarnessStrategy');
        const strategy = new SqliteHarnessStrategy();
        await runDialectConformanceSuite(strategy, {
            createOptions: { resetMode: ResetMode.Truncate, sqliteFile: ':memory:' },
        });
        connectSpy.mockRestore();
    });
});
