import { z } from 'zod';
import { EnvConfigSchema, type EnvConfig, type EnvName } from './EnvConfig';
import { InternalEnvName } from './internal/InternalEnvName';

/**
 * Root Tango framework configuration across deployment environments.
 */
export type TangoConfig = {
    current: EnvName;
    environments: {
        development: EnvConfig;
        test: EnvConfig;
        production: EnvConfig;
    };
};

/**
 * Runtime schema for validating Tango config files.
 */
export const TangoConfigSchema: z.ZodTypeAny = z.object({
    current: z.enum(Object.values(InternalEnvName)).default(InternalEnvName.DEVELOPMENT),
    environments: z.object({
        development: EnvConfigSchema,
        test: EnvConfigSchema,
        production: EnvConfigSchema,
    }),
});
