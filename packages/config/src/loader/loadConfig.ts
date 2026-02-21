import { config as loadDotEnv } from 'dotenv';
import { TangoConfigSchema, type EnvConfig, type TangoConfig } from '../schema/index';
import type { LoadedConfig } from './LoadedConfig';

/**
 * Load, validate, and environment-resolve Tango configuration.
 */
export function loadConfig(fromFile: () => unknown): LoadedConfig {
    loadDotEnv();

    const cfg = TangoConfigSchema.parse(fromFile()) as TangoConfig;
    const env = cfg.current;
    const current = mergeEnvOverrides(cfg.environments[env]);

    return { cfg, env, current };
}

/**
 * Merge process environment overrides into a base environment config.
 */
function mergeEnvOverrides(envCfg: EnvConfig): EnvConfig {
    const result = structuredClone(envCfg);
    const env = process.env;

    if (env.TANGO_DB_ADAPTER) {
        result.db.adapter = env.TANGO_DB_ADAPTER as 'postgres' | 'sqlite';
    }

    if (env.DATABASE_URL || env.TANGO_DATABASE_URL) {
        result.db.url = env.TANGO_DATABASE_URL || env.DATABASE_URL;
    }

    if (env.TANGO_DB_HOST) result.db.host = env.TANGO_DB_HOST;
    if (env.TANGO_DB_PORT) result.db.port = Number(env.TANGO_DB_PORT);
    if (env.TANGO_DB_NAME) result.db.database = env.TANGO_DB_NAME;
    if (env.TANGO_DB_USER) result.db.user = env.TANGO_DB_USER;
    if (env.TANGO_DB_PASSWORD) result.db.password = env.TANGO_DB_PASSWORD;
    if (env.TANGO_SQLITE_FILENAME) result.db.filename = env.TANGO_SQLITE_FILENAME;

    if (env.TANGO_MIGRATIONS_DIR) result.migrations.dir = env.TANGO_MIGRATIONS_DIR;
    if (env.TANGO_MIGRATIONS_ONLINE) {
        result.migrations.online = env.TANGO_MIGRATIONS_ONLINE === 'true';
    }

    return result;
}
