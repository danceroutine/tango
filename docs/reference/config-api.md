# Config API

`@danceroutine/tango-config` defines the typed contract for `tango.config.*` and the loaders that turn that file into the active runtime configuration for a process.

Most application config files only need one entrypoint: `defineConfig(...)`.

The package also exports two loader helpers. `loadConfig(...)` is for code that already has the config module in hand. `loadConfigFromProjectRoot(...)` is for tooling or startup code that should discover `tango.config.*` from a project root.

## `defineConfig(...)`

`defineConfig(...)` validates a Tango config object and returns the parsed result.

Use it in `tango.config.ts` so invalid configuration fails when the module is loaded, before the rest of the application starts.

```ts
import { defineConfig } from '@danceroutine/tango-config';

export default defineConfig({
    current: 'development',
    environments: {
        development: {
            name: 'development',
            db: {
                adapter: 'sqlite',
                filename: './.data/app.sqlite',
                maxConnections: 1,
            },
            migrations: {
                dir: './migrations',
                online: false,
                autoApply: true,
            },
        },
        test: {
            name: 'test',
            db: {
                adapter: 'sqlite',
                filename: ':memory:',
                maxConnections: 1,
            },
            migrations: {
                dir: './migrations',
                online: false,
                autoApply: true,
            },
        },
        production: {
            name: 'production',
            db: {
                adapter: 'postgres',
                url: process.env.TANGO_DATABASE_URL,
                maxConnections: 20,
            },
            migrations: {
                dir: './migrations',
                online: true,
                autoApply: true,
            },
        },
    },
});
```

## `loadConfig(...)`

`loadConfig(fromFile)` validates a config module, resolves the selected environment, loads `.env`, and applies the supported Tango environment-variable overrides.

It returns a `LoadedConfig` object with three fields:

- `cfg`: the fully validated `TangoConfig`
- `env`: the selected environment name
- `current`: the resolved `EnvConfig` for that environment after overrides are merged

Application runtime code usually reads `loaded.current.db` and `loaded.current.migrations`, because those are the settings that matter to the current process.

```ts
import tangoConfig from '../tango.config';
import { loadConfig } from '@danceroutine/tango-config';

const loaded = loadConfig(() => tangoConfig);

const dbConfig = loaded.current.db;
const migrationsConfig = loaded.current.migrations;
```

`loadConfig(...)` is the right helper when your code already has the config module in hand and wants the resolved settings for the current process.

## `loadConfigFromProjectRoot(...)`

`loadConfigFromProjectRoot(...)` finds a Tango config file under a project root, loads it, validates it, and returns the same `LoadedConfig` shape as `loadConfig(...)`.

Use it in tools, scripts, or startup paths that should discover the config automatically instead of importing it directly.

```ts
import { loadConfigFromProjectRoot } from '@danceroutine/tango-config';

const loaded = loadConfigFromProjectRoot({
    projectRoot: process.cwd(),
});
```

The loader searches these filenames in order when `configPath` is not provided:

- `tango.config.ts`
- `tango.config.mts`
- `tango.config.cts`
- `tango.config.js`
- `tango.config.mjs`
- `tango.config.cjs`

If `configPath` is provided, Tango resolves it relative to `projectRoot` instead of searching that default filename list.

## `TangoConfig`

`TangoConfig` is the root configuration shape.

Application code supplies two things:

- `current`, which selects the environment the current process should use
- `environments`, which contains the declared settings for `development`, `test`, and `production`

Each entry in `environments` is an `EnvConfig`, so the root contract is really one environment selector plus three named environment declarations.

## `EnvConfig`

`EnvConfig` describes one named runtime environment.

Each environment declaration pairs three concerns in one object: `name`, which must match the environment key, `db`, which describes the database connection for that environment, and `migrations`, which describes the migration settings for that same environment.

Tango currently fixes the environment names at `development`, `test`, and `production`, so the purpose of `EnvConfig` is to keep the database and migration settings for one of those three environments together.

## `DbConfig`

`DbConfig` tells Tango which database adapter to use and how to connect to it.

Every `DbConfig` declares an `adapter` and a `maxConnections` value. The remaining fields depend on how that adapter is configured.

SQLite configurations usually provide `filename` and a low `maxConnections`, because the connection target is one local database file.

PostgreSQL configurations usually provide either a single `url` or the discrete connection fields `host`, `port`, `database`, `user`, and `password`, then choose a `maxConnections` value appropriate to the runtime environment.

`maxConnections` defaults to `10` when omitted.

## `MigrationsConfig`

`MigrationsConfig` keeps migration execution settings next to the database configuration that uses them.

Its three fields are `dir`, which points to the migration directory, `online`, which selects online migration mode, and `autoApply`, which controls whether `tango migrate` is allowed to apply pending steps.

If they are omitted, Tango uses `dir: 'migrations'`, `online: false`, and `autoApply: true`.

In many applications, `dir` is the only value that changes regularly. `online` and `autoApply` become more important when a deployment environment needs tighter control over how migrations are applied.

## Environment variable overrides

`loadConfig(...)` and `loadConfigFromProjectRoot(...)` merge a fixed set of environment-variable overrides into the selected environment after the config file has been parsed.

This is the layer that usually changes between local development, CI, preview deployments, and production. The config file establishes the base contract. Environment variables patch the selected environment for the current process.

For database selection and connection targets, the supported overrides are:

- `TANGO_DB_ADAPTER`
- `TANGO_DATABASE_URL`
- `DATABASE_URL`
- `TANGO_DB_HOST`
- `TANGO_DB_PORT`
- `TANGO_DB_NAME`
- `TANGO_DB_USER`
- `TANGO_DB_PASSWORD`
- `TANGO_SQLITE_FILENAME`

For migration behavior, the supported overrides are:

- `TANGO_MIGRATIONS_DIR`
- `TANGO_MIGRATIONS_ONLINE`

When both are present, `TANGO_DATABASE_URL` takes precedence over `DATABASE_URL`.

The common pattern is to keep the stable shape of the environment in `tango.config.*`, then let deployment-specific values such as database host, URL, credentials, or migration mode come from environment variables.

## CLI integration

The migration commands in `@danceroutine/tango-cli` resolve their settings from Tango config directly.

The CLI follows the same general flow as application startup.

First, it loads `tango.config.*` from the project root, or from the file selected with `--config`.

Second, it resolves the active environment from that file. By default it uses `current`. `--env` selects a different environment from the same config file.

Third, it reads the migration settings from that resolved environment. The dialect comes from `current.db.adapter`, the database target comes from `current.db`, and the migration directory comes from `current.migrations.dir`.

Finally, explicit command-line flags override the values inferred from config.

This config-aware behavior applies to `tango make:migrations`, `tango migrate`, `tango plan`, and `tango status`.

## Schemas and subpaths

The root package export is enough for most applications. It includes the loader helpers, the config types, and the Zod schemas that back validation: `AdapterNameSchema`, `DbConfigSchema`, `MigrationsConfigSchema`, `EnvConfigSchema`, and `TangoConfigSchema`.

The narrower subpaths, `@danceroutine/tango-config/loader` and `@danceroutine/tango-config/schema`, are mainly useful when tooling or shared libraries want a smaller import boundary than the root package export.

## Related pages

- [Configure databases](/how-to/databases)
- [Migrate schema changes](/how-to/work-with-models#migrate-schema-changes)
- [CLI API](/reference/cli-api)
