import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialect, ResetMode, type IntegrationHarness } from '../../domain/index';
import { anAdapter } from '../../../mocks/anAdapter';

function harnessFor(dialect: Dialect): IntegrationHarness {
    return {
        dialect,
        adapter: anAdapter({ dialect: dialect === Dialect.Postgres ? 'postgres' : 'sqlite' }),
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

describe('createQuerySetFixture', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('warns once and delegates to createModelQuerySetFixture', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.resetModules();

        const { createQuerySetFixture } = await import('../createQuerySetFixture');
        const harness = harnessFor(Dialect.Sqlite);

        const first = createQuerySetFixture<{ id: number }>({
            harness,
            meta: {
                table: 'users',
                pk: 'id',
                columns: { id: 'int' },
            },
        });
        const second = createQuerySetFixture<{ id: number }>({
            harness,
            meta: {
                table: 'users',
                pk: 'id',
                columns: { id: 'int' },
            },
        });

        await expect(first.fetchOne()).resolves.toEqual({ id: 1 });
        await expect(second.fetchOne()).resolves.toEqual({ id: 1 });
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith(
            '[tango.testing.integration]',
            '`createQuerySetFixture(...)` is deprecated. Use `createModelQuerySetFixture(...)` instead.'
        );
    });
});
