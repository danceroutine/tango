import { describe, expect, it, vi } from 'vitest';
import { aDBClient } from '../../../mocks/aDBClient';
import {
    Dialect,
    ResetMode,
    type DialectTestCapabilities,
    type HarnessStrategy,
    type IntegrationHarness,
} from '../../domain';
import { runDialectConformanceSuite } from '../runDialectConformanceSuite';

const baseCapabilities: DialectTestCapabilities = {
    transactionalDDL: true,
    supportsSchemas: false,
    supportsConcurrentIndex: false,
    supportsDeferredFkValidation: false,
    supportsJsonb: false,
};

function makeHarness(overrides: Partial<IntegrationHarness> = {}): IntegrationHarness {
    let initialized = false;
    const client = aDBClient();
    return {
        dialect: Dialect.Sqlite,
        capabilities: baseCapabilities,
        resetMode: ResetMode.DropSchema,
        get dbClient() {
            if (!initialized) throw new Error('not initialized');
            return client;
        },
        setup: vi.fn(async () => {
            initialized = true;
        }),
        reset: vi.fn(async () => {
            if (!initialized) throw new Error('not initialized');
        }),
        teardown: vi.fn(async () => {
            initialized = false;
        }),
        migrationRunner: vi.fn(() => ({}) as never),
        ...overrides,
    } as IntegrationHarness;
}

function strategyFor(harness: IntegrationHarness): HarnessStrategy {
    return {
        dialect: harness.dialect,
        capabilities: harness.capabilities,
        create: vi.fn(async () => harness),
    };
}

describe(runDialectConformanceSuite, () => {
    it('passes for a conformant strategy', async () => {
        const harness = makeHarness();
        await expect(runDialectConformanceSuite(strategyFor(harness))).resolves.toBeUndefined();
    });

    it('fails when harness dialect does not match strategy dialect', async () => {
        const harness = makeHarness({ dialect: Dialect.Postgres });
        const strategy = strategyFor(harness);
        (strategy as { dialect: Dialect }).dialect = Dialect.Sqlite;
        await expect(runDialectConformanceSuite(strategy)).rejects.toThrow(
            "Conformance failed: harness dialect 'postgres' does not match strategy dialect 'sqlite'"
        );
    });

    it('fails when capabilities do not use the strategy reference', async () => {
        const harness = makeHarness();
        const strategy: HarnessStrategy = {
            ...strategyFor(harness),
            capabilities: { ...baseCapabilities },
        };
        await expect(runDialectConformanceSuite(strategy)).rejects.toThrow(
            'Conformance failed: harness capabilities must be strategy capabilities reference'
        );
    });

    it('fails when reset does not throw before setup', async () => {
        const harness = makeHarness({
            reset: vi.fn(async () => {}),
        });
        await expect(runDialectConformanceSuite(strategyFor(harness))).rejects.toThrow(
            'Conformance failed: reset() must throw before setup()'
        );
    });

    it('fails when dbClient does not throw after teardown', async () => {
        const harness = makeHarness({
            get dbClient() {
                return {
                    ...aDBClient(),
                };
            },
        });
        await expect(runDialectConformanceSuite(strategyFor(harness))).rejects.toThrow(
            'Conformance failed: dbClient getter must throw after teardown()'
        );
    });
});
