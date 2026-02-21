import { z } from 'zod';
import { DbConfigSchema, type DbConfig } from './DbConfig';
import { MigrationsConfigSchema, type MigrationsConfig } from './MigrationsConfig';
import { InternalEnvName } from './internal/InternalEnvName';

export type EnvName = (typeof InternalEnvName)[keyof typeof InternalEnvName];

export type EnvConfig = {
    name: EnvName;
    db: DbConfig;
    migrations: MigrationsConfig;
};

export const EnvConfigSchema: z.ZodTypeAny = z.object({
    name: z.enum(Object.values(InternalEnvName)),
    db: DbConfigSchema,
    migrations: MigrationsConfigSchema.default({
        dir: 'migrations',
        online: false,
    }),
});
