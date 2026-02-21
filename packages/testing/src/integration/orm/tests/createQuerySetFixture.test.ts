import { describe, expect, it, vi } from 'vitest';
import { createQuerySetFixture } from '../index';
import { Dialect, ResetMode, type IntegrationHarness } from '../../domain/index';

function harnessFor(dialect: Dialect): IntegrationHarness {
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
            query: vi.fn(async () => ({ rows: [{ id: 1 }] })),
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

describe(createQuerySetFixture, () => {
    it('creates a queryset fixture with supplied metadata', async () => {
        const harness = harnessFor(Dialect.Sqlite);
        const queryset = createQuerySetFixture<{ id: number }>({
            harness,
            meta: {
                table: 'users',
                pk: 'id',
                columns: { id: 'int' },
            },
        });

        await expect(queryset.fetchOne()).resolves.toEqual({ id: 1 });
        expect(vi.mocked(harness.dbClient.query)).toHaveBeenCalledWith(
            'SELECT users.* FROM users ORDER BY users.id ASC LIMIT 1',
            []
        );
    });
});
