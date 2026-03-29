import { describe, expect, it, vi } from 'vitest';
import { seedTable } from '../index';
import { Dialect, ResetMode, type IntegrationHarness } from '../../domain/index';

function harnessFor(dialect: Dialect): IntegrationHarness {
    const query = vi.fn(async () => ({ rows: [] }));
    return {
        dialect,
        capabilities: {
            transactionalDDL: true,
            supportsSchemas: dialect === Dialect.Postgres,
            supportsConcurrentIndex: false,
            supportsDeferredFkValidation: false,
            supportsJsonb: false,
        },
        resetMode: ResetMode.DropSchema,
        dbClient: {
            query,
            begin: vi.fn(async () => {}),
            commit: vi.fn(async () => {}),
            rollback: vi.fn(async () => {}),
            close: vi.fn(async () => {}),
        },
        setup: vi.fn(async () => {}),
        reset: vi.fn(async () => {}),
        teardown: vi.fn(async () => {}),
        migrationRunner: vi.fn(),
    } as unknown as IntegrationHarness;
}

describe('seedTable', () => {
    it('no-ops for empty rows and empty row shape', async () => {
        const harness = harnessFor(Dialect.Sqlite);
        await seedTable(harness, 'users', []);
        await seedTable(harness, 'users', [{}]);
        expect(harness.dbClient.query).not.toHaveBeenCalled();
    });

    it('inserts rows with dialect-specific placeholders and sqlite boolean normalization', async () => {
        const sqlite = harnessFor(Dialect.Sqlite);
        await seedTable(sqlite, 'users', [{ id: 1, active: true }]);
        await seedTable(sqlite, 'users', [{ id: 2, active: false }]);
        expect(sqlite.dbClient.query).toHaveBeenCalledWith(
            'INSERT INTO "users" ("id", "active") VALUES (?, ?)',
            [1, 1]
        );
        expect(sqlite.dbClient.query).toHaveBeenCalledWith(
            'INSERT INTO "users" ("id", "active") VALUES (?, ?)',
            [2, 0]
        );

        const postgres = harnessFor(Dialect.Postgres);
        await seedTable(postgres, 'users', [{ id: 1, active: false }]);
        expect(postgres.dbClient.query).toHaveBeenCalledWith('INSERT INTO "users" ("id", "active") VALUES ($1, $2)', [
            1,
            false,
        ]);
    });

    it('skips inserts when derived columns are empty', async () => {
        const sqlite = harnessFor(Dialect.Sqlite);
        await seedTable(sqlite, 'users', [undefined as unknown as Record<string, unknown>] as Array<
            Record<string, unknown>
        >);
        expect(sqlite.dbClient.query).not.toHaveBeenCalled();
    });
});
