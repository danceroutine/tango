import { beforeEach, describe, expect, it } from 'vitest';
import { aTangoConfig } from '@danceroutine/tango-testing';
import { loadConfig } from '@danceroutine/tango-config';
import { TangoRuntime } from '../TangoRuntime';
import { resetTangoRuntime } from '../defaultRuntime';

describe(TangoRuntime, () => {
    beforeEach(async () => {
        await resetTangoRuntime();
    });

    it('initializes from config and exposes config, dialect, and branding', () => {
        const runtime = new TangoRuntime(() => loadConfig(() => aTangoConfig()));

        expect(TangoRuntime.isTangoRuntime(runtime)).toBe(true);
        expect(TangoRuntime.isTangoRuntime({})).toBe(false);
        expect(runtime.getDialect()).toBe('sqlite');
        expect(runtime.getConfig().current.db.adapter).toBe('sqlite');
    });

    it('shares a single in-flight client initialization and recreates the client after reset', async () => {
        const runtime = new TangoRuntime(() => loadConfig(() => aTangoConfig()));

        const [first, second] = await Promise.all([runtime.getClient(), runtime.getClient()]);
        expect(first).toBe(second);

        await runtime.reset();

        const third = await runtime.getClient();
        expect(third).not.toBe(first);

        await runtime.reset();
    });

    it('returns early when reset is called before any client is created', async () => {
        const runtime = new TangoRuntime(() => loadConfig(() => aTangoConfig({ adapter: 'postgres' })));

        await expect(runtime.reset()).resolves.toBeUndefined();
        expect(runtime.getDialect()).toBe('postgres');
    });
});
