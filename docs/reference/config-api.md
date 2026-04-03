# Config API

`@danceroutine/tango-config` gives a Tango application one typed place to describe runtime environments and one loader that resolves the active environment at startup.

Most Tango applications put that declaration in `tango.config.ts`. The same file can then serve three parts of the stack:

- application startup code that needs database and migration settings
- the `tango` CLI, which can infer migration defaults from the file
- deployment environments that override selected values through environment variables

## The configuration contract

A Tango config declares three named environments: `development`, `test`, and `production`. The `current` field selects which one should be used for the current process.

Each environment contains:

- `name`, which must match the environment key
- `db`, which describes the database adapter and connection settings
- `migrations`, which describes where migration files live and whether migrations run online

Generated Tango applications use that shape directly:

```ts
import { defineConfig } from '@danceroutine/tango-config';

export default defineConfig({
    current: (process.env.NODE_ENV || 'development') as 'development' | 'test' | 'production',
    environments: {
        development: {
            name: 'development',
            db: {
                adapter: 'sqlite',
                filename: './.data/app.sqlite',
                maxConnections: 1,
            },
            migrations: { dir: './migrations', online: false },
        },
        test: {
            name: 'test',
            db: {
                adapter: 'sqlite',
                filename: ':memory:',
                maxConnections: 1,
            },
            migrations: { dir: './migrations', online: false },
        },
        production: {
            name: 'production',
            db: {
                adapter: 'postgres',
                url: process.env.TANGO_DATABASE_URL,
                maxConnections: 20,
            },
            migrations: { dir: './migrations', online: true },
        },
    },
});
```

## `defineConfig()`

`defineConfig()` validates the config object when the module is loaded and returns the parsed result. It is the right helper for the config file itself because it keeps the declaration close to the runtime schema.

Use it when you want invalid configuration to fail immediately, before the rest of the application starts.

## `loadConfig()`

`loadConfig()` resolves a validated config into the environment your process should actually use. It returns:

- `cfg`, the full validated config object
- `env`, the selected environment name
- `current`, the resolved environment settings for that process

`loadConfig()` also loads `.env` through `dotenv` and then merges supported Tango overrides into the selected environment. Application runtime code usually reads `loaded.current.db` and `loaded.current.migrations` rather than reaching back into the full config object.

```ts
import { loadConfig } from '@danceroutine/tango-config';
import tangoConfig from '../tango.config';

const loadedConfig = loadConfig(() => tangoConfig);

const db = loadedConfig.current.db;
```

## Database settings

The `db` section chooses the adapter and the connection target.

For SQLite, application code usually relies on:

- `adapter: 'sqlite'`
- `filename`
- `maxConnections`

For PostgreSQL, application code usually relies on:

- `adapter: 'postgres'`
- either `url` or the discrete connection fields
- `maxConnections`

The loader does not choose a connection strategy for you. It resolves config. Your ORM setup still decides how to map those settings into a concrete adapter connection.

## Migration settings

The `migrations` section keeps the migration directory and online/offline mode next to the database configuration that uses them.

- `dir` defaults to `migrations`
- `online` defaults to `false`

The migrations CLI reads those values when it auto-loads `tango.config.ts`, which keeps the runtime and migration workflow aligned around the same config source.

## Environment overrides

`loadConfig()` merges a fixed set of overrides into the selected environment after the config file has been parsed.

Supported database overrides:

- `TANGO_DB_ADAPTER`
- `TANGO_DATABASE_URL`
- `DATABASE_URL`
- `TANGO_DB_HOST`
- `TANGO_DB_PORT`
- `TANGO_DB_NAME`
- `TANGO_DB_USER`
- `TANGO_DB_PASSWORD`
- `TANGO_SQLITE_FILENAME`

Supported migration overrides:

- `TANGO_MIGRATIONS_DIR`
- `TANGO_MIGRATIONS_ONLINE`

`TANGO_DATABASE_URL` takes precedence over `DATABASE_URL` when both are present.

## CLI integration

Migration commands auto-load `./tango.config.ts` when it exists. That allows commands such as `tango migrate`, `tango plan`, `tango status`, and `tango make:migrations` to infer:

- the dialect from `current.db.adapter`
- the database target from `current.db`
- the migration directory from `current.migrations.dir`

`--config` selects a different config file. `--env` selects a different environment from that file. Explicit CLI flags such as `--dialect`, `--db`, and `--dir` override the values inferred from config.

## Subpath exports

The root package export is enough for most applications:

- `defineConfig()`
- `loadConfig()`
- `LoadedConfig`
- the core config types and schemas

The `@danceroutine/tango-config/loader` and `@danceroutine/tango-config/schema` subpaths are useful when you want a narrower import boundary in application code or tooling.

## Related pages

- [Configure databases](/how-to/databases)
- [Migrate schema changes](/how-to/work-with-models#migrate-schema-changes)
- [CLI API](/reference/cli-api)
