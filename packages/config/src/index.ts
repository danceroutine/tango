/**
 * Bundled exports for Django-style domain drill-down imports, plus curated
 * top-level symbols for TS-native ergonomic imports.
 */
export * as schema from './schema/index';
export * as loader from './loader/index';

export {
    defineConfig,
    loadConfig,
    loadConfigFromProjectRoot,
    type LoadedConfig,
    type ProjectConfigLoadOptions,
} from './loader/index';
export type { AdapterName, DbConfig, EnvConfig, EnvName, MigrationsConfig, TangoConfig } from './schema/index';
export {
    AdapterNameSchema,
    DbConfigSchema,
    EnvConfigSchema,
    MigrationsConfigSchema,
    TangoConfigSchema,
} from './schema/index';
