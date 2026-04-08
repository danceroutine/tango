import { describe, expect, it } from 'vitest';
import { withGlobalTestApi } from '../withGlobalTestApi';

describe(withGlobalTestApi, () => {
    it('installs and removes a temporary global binding', async () => {
        expect((globalThis as Record<string, unknown>).tangoTempApi).toBeUndefined();

        const result = await withGlobalTestApi('tangoTempApi', { value: 7 }, async () => {
            return (globalThis as Record<string, unknown>).tangoTempApi;
        });

        expect(result).toEqual({ value: 7 });
        expect((globalThis as Record<string, unknown>).tangoTempApi).toBeUndefined();
    });

    it('restores an existing global binding after the callback completes', async () => {
        (globalThis as Record<string, unknown>).tangoTempApi = { original: true };

        await withGlobalTestApi('tangoTempApi', { override: true }, async () => {
            expect((globalThis as Record<string, unknown>).tangoTempApi).toEqual({ override: true });
        });

        expect((globalThis as Record<string, unknown>).tangoTempApi).toEqual({ original: true });
        delete (globalThis as Record<string, unknown>).tangoTempApi;
    });
});
