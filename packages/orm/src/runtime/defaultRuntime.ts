import { loadConfig, loadConfigFromProjectRoot } from '@danceroutine/tango-config';
import { TangoRuntime } from './TangoRuntime';

let defaultRuntime: TangoRuntime | null = null;

/**
 * Initialize the process-default Tango runtime from a Tango config loader.
 */
export function initializeTangoRuntime(fromFile: () => unknown): TangoRuntime {
    defaultRuntime = new TangoRuntime(() => loadConfig(fromFile));
    return defaultRuntime;
}

/**
 * Return the process-default Tango runtime, lazily loading Tango config on first access.
 */
export function getTangoRuntime(): TangoRuntime {
    if (!defaultRuntime) {
        defaultRuntime = new TangoRuntime(() => loadConfigFromProjectRoot());
    }

    return defaultRuntime;
}

/**
 * Reset the process-default Tango runtime and release any cached client.
 */
export async function resetTangoRuntime(): Promise<void> {
    if (!defaultRuntime) {
        return;
    }

    const runtime = defaultRuntime;
    defaultRuntime = null;
    await runtime.reset();
}
