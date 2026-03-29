import { afterEach, describe, expect, it } from 'vitest';
import { getTangoRuntime, resetTangoRuntime } from '@danceroutine/tango-orm';
import { setupTestTangoRuntime } from '../setupTestTangoRuntime';

describe(setupTestTangoRuntime, () => {
    afterEach(async () => {
        await resetTangoRuntime();
    });

    it('resets and initializes the default tango runtime', async () => {
        const runtime = await setupTestTangoRuntime();

        expect(getTangoRuntime()).toBe(runtime);
        expect(runtime.getDialect()).toBe('sqlite');
    });

    it('supports postgres-backed runtime setup', async () => {
        const runtime = await setupTestTangoRuntime({ adapter: 'postgres' });

        expect(runtime.getDialect()).toBe('postgres');
    });
});
