import { vi } from 'vitest';
import { anAdapter } from '../mocks/anAdapter';
import { aDBClient } from '../mocks/aDBClient';
import { Dialect } from './domain/Dialect';
import { ResetMode } from './domain/ResetMode';
import type { DialectTestCapabilities, IntegrationHarness } from './domain/IntegrationHarness';

const defaultCapabilities: DialectTestCapabilities = {
    transactionalDDL: true,
    supportsSchemas: false,
    supportsConcurrentIndex: false,
    supportsDeferredFkValidation: false,
    supportsJsonb: false,
};

/**
 * Create an integration-harness fixture with optional overrides.
 */
export function anIntegrationHarness(overrides: Partial<IntegrationHarness> = {}): IntegrationHarness {
    return {
        dialect: Dialect.Sqlite,
        adapter: anAdapter({ dialect: 'sqlite' }),
        capabilities: defaultCapabilities,
        resetMode: ResetMode.DropSchema,
        dbClient: aDBClient(),
        setup: vi.fn(async () => {}),
        reset: vi.fn(async () => {}),
        teardown: vi.fn(async () => {}),
        migrationRunner: vi.fn(() => ({}) as never),
        ...overrides,
    };
}
