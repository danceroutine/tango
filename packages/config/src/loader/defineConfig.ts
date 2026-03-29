import { TangoConfigSchema, type TangoConfig } from '../schema/index';

/**
 * Define and validate Tango configuration at declaration time.
 */
export function defineConfig(cfg: unknown): TangoConfig {
    return TangoConfigSchema.parse(cfg) as TangoConfig;
}
