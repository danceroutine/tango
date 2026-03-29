import type { EnvConfig, EnvName, TangoConfig } from '../schema/index';

/**
 * Fully resolved Tango configuration for a specific runtime environment.
 */
export interface LoadedConfig {
    cfg: TangoConfig;
    env: EnvName;
    current: EnvConfig;
}
