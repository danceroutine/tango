import { describe, expect, it, vi } from 'vitest';
import { anIntegrationHarness } from '../anIntegrationHarness';
import { Dialect, ResetMode } from '../domain';

describe(anIntegrationHarness, () => {
    it('creates a default sqlite harness fixture', async () => {
        const harness = anIntegrationHarness();

        expect(harness.dialect).toBe(Dialect.Sqlite);
        expect(harness.resetMode).toBe(ResetMode.DropSchema);
        expect(harness.capabilities.supportsSchemas).toBe(false);
        await expect(harness.setup()).resolves.toBeUndefined();
        await expect(harness.reset()).resolves.toBeUndefined();
        await expect(harness.teardown()).resolves.toBeUndefined();
        expect(harness.migrationRunner('migrations')).toEqual({});
    });

    it('applies overrides', () => {
        const setup = vi.fn(async () => {});
        const harness = anIntegrationHarness({
            dialect: Dialect.Postgres,
            setup,
        });

        expect(harness.dialect).toBe(Dialect.Postgres);
        void harness.setup();
        expect(setup).toHaveBeenCalled();
    });
});
