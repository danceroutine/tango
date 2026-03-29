import { initializeTangoRuntime, resetTangoRuntime, type TangoRuntime } from '@danceroutine/tango-orm';
import { aTangoConfig, type TestTangoConfigOptions } from './aTangoConfig';

/**
 * Reset and initialize the process-default Tango runtime for tests.
 */
export async function setupTestTangoRuntime(options: TestTangoConfigOptions = {}): Promise<TangoRuntime> {
    await resetTangoRuntime();
    return initializeTangoRuntime(() => aTangoConfig(options));
}
