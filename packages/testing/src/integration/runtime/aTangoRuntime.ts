import { loadConfig } from '@danceroutine/tango-config';
import { TangoRuntime } from '@danceroutine/tango-orm';
import { aTangoConfig, type TestTangoConfigOptions } from './aTangoConfig';

/**
 * Create a standalone Tango runtime for tests without mutating the process-default runtime.
 */
export function aTangoRuntime(options: TestTangoConfigOptions = {}): TangoRuntime {
    return new TangoRuntime(() => loadConfig(() => aTangoConfig(options)));
}
