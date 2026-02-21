import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aTangoConfig } from '@danceroutine/tango-testing';

describe('defaultRuntime', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(async () => {
        const runtimeModule = await import('../defaultRuntime');
        await runtimeModule.resetTangoRuntime();
        vi.resetModules();
        vi.unmock('@danceroutine/tango-config');
    });

    it('lazy-initializes the default runtime from project config', async () => {
        vi.doMock('@danceroutine/tango-config', async () => {
            const actual =
                await vi.importActual<typeof import('@danceroutine/tango-config')>('@danceroutine/tango-config');

            return {
                ...actual,
                loadConfigFromProjectRoot: vi.fn(() => actual.loadConfig(() => aTangoConfig())),
            };
        });

        const runtimeModule = await import('../defaultRuntime');
        const runtime = runtimeModule.getTangoRuntime();

        expect(runtime.getDialect()).toBe('sqlite');
        expect(runtimeModule.getTangoRuntime()).toBe(runtime);
    });

    it('returns the explicitly initialized runtime instance', async () => {
        const runtimeModule = await import('../defaultRuntime');
        const runtime = runtimeModule.initializeTangoRuntime(() => aTangoConfig());

        expect(runtimeModule.getTangoRuntime()).toBe(runtime);
    });
});
