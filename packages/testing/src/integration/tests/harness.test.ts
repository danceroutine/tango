import { describe, expect, it, vi } from 'vitest';
import { anIntegrationHarness } from '../anIntegrationHarness';
import { HarnessStrategyRegistry } from '../HarnessStrategyRegistry';
import { TestHarness } from '../TestHarness';
import { Dialect, type HarnessStrategy } from '../domain';

describe(HarnessStrategyRegistry, () => {
    it('stores strategies by dialect and exposes them for lookup', async () => {
        const harness = anIntegrationHarness();
        const create = vi.fn(async () => harness);
        const strategy: HarnessStrategy = {
            dialect: Dialect.Sqlite,
            capabilities: harness.capabilities,
            create,
        };

        const registry = new HarnessStrategyRegistry().register(strategy);
        expect(HarnessStrategyRegistry.isHarnessStrategyRegistry(registry)).toBe(true);
        expect(HarnessStrategyRegistry.isHarnessStrategyRegistry({})).toBe(false);
        expect(registry.list()).toHaveLength(1);
        expect(registry.get(Dialect.Sqlite)).toBe(strategy);
        expect(() => registry.get(Dialect.Postgres)).toThrow('No harness strategy registered for dialect: postgres');
    });
});

describe(TestHarness, () => {
    it('creates harnesses through the selected dialect strategy', async () => {
        const sqliteHarness = anIntegrationHarness();
        const postgresHarness = anIntegrationHarness({ dialect: Dialect.Postgres });
        const sqliteCreate = vi.fn(async () => sqliteHarness);
        const postgresCreate = vi.fn(async () => postgresHarness);

        const registry = new HarnessStrategyRegistry()
            .register({
                dialect: Dialect.Sqlite,
                capabilities: sqliteHarness.capabilities,
                create: sqliteCreate,
            })
            .register({
                dialect: Dialect.Postgres,
                capabilities: postgresHarness.capabilities,
                create: postgresCreate,
            });

        expect(TestHarness.isTestHarness(new TestHarness())).toBe(true);
        expect(TestHarness.isTestHarness({})).toBe(false);

        await expect(TestHarness.forDialect({ dialect: Dialect.Sqlite }, registry)).resolves.toBe(sqliteHarness);
        await expect(TestHarness.sqlite(undefined)).resolves.toMatchObject({ dialect: Dialect.Sqlite });
        await expect(TestHarness.postgres(undefined)).resolves.toMatchObject({ dialect: Dialect.Postgres });
    });

    it('reuses one shared registry for strategy registration', () => {
        const first = TestHarness.getRegistry();
        const second = TestHarness.getRegistry();
        expect(first).toBe(second);

        const strategy: HarnessStrategy = {
            dialect: 'custom',
            capabilities: {
                transactionalDDL: false,
                supportsSchemas: false,
                supportsConcurrentIndex: false,
                supportsDeferredFkValidation: false,
                supportsJsonb: false,
            },
            create: vi.fn(async () => anIntegrationHarness()),
        };
        TestHarness.registerStrategy(strategy);
        expect(TestHarness.getRegistry().get('custom')).toBe(strategy);
    });
});
