# How to configure databases

`tango.config.ts` is the normal place to describe database configuration in a Tango application.

That file keeps development, test, and production settings together, and it gives the runtime code and the `tango` CLI the same source of truth.

## Start with `tango.config.ts`

Generated Tango applications define their database settings with `@danceroutine/tango-config`:

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

At runtime, application code resolves the active environment with `loadConfig()` and then reads `loaded.current.db`.

```ts
import { loadConfig } from '@danceroutine/tango-config';
import tangoConfig from '../tango.config';

const loadedConfig = loadConfig(() => tangoConfig);
const db = loadedConfig.current.db;
```

## SQLite configuration

SQLite is the simplest choice for local development, examples, and fast integration loops. In Tango, that usually means:

- `adapter: 'sqlite'`
- a project-local file such as `./.data/app.sqlite` for development
- `:memory:` for test runs that should stay isolated and fast
- `maxConnections: 1`, because SQLite usually runs as a single-process local database

The generated application scaffolds follow that pattern directly in `tango.config.ts`.

## PostgreSQL configuration

PostgreSQL is the stronger choice when you want production parity, realistic connection behavior, and migration validation against the backend you expect to deploy.

You can describe PostgreSQL in two common ways:

- with a single `url`
- with discrete fields such as `host`, `port`, `database`, `user`, and `password`

The loader supports both shapes. Application code can then pass the resolved values into `PostgresAdapter.connect()`.

```ts
db: {
    adapter: 'postgres',
    url: process.env.TANGO_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/app',
    maxConnections: 10,
}
```

## A practical environment strategy

Most teams should keep the strategy simple:

- use SQLite for local iteration when startup speed matters
- use PostgreSQL in CI for backend-parity integration checks
- use the same PostgreSQL family in production that you test in CI

That setup gives developers a fast inner loop while still forcing the project to prove its behavior against the production-style backend before merge.

## Environment overrides

`loadConfig()` loads `.env` automatically and then merges a fixed set of Tango-specific overrides into the selected environment.

The most common overrides are:

- `TANGO_DATABASE_URL` or `DATABASE_URL` for PostgreSQL URLs
- `TANGO_SQLITE_FILENAME` for SQLite files
- `TANGO_DB_HOST`, `TANGO_DB_PORT`, `TANGO_DB_NAME`, `TANGO_DB_USER`, and `TANGO_DB_PASSWORD` for discrete PostgreSQL settings
- `TANGO_MIGRATIONS_DIR` and `TANGO_MIGRATIONS_ONLINE` for migration behavior

That lets you keep the broad shape of the environment in `tango.config.ts` while still injecting deployment-specific values from the process environment.

## How the CLI uses config

The migrations CLI auto-loads `./tango.config.ts` when the file exists. That allows commands such as `tango migrate` and `tango make:migrations` to infer:

- the dialect from `current.db.adapter`
- the database target from `current.db`
- the migrations directory from `current.migrations.dir`

Use `--config` when the file lives somewhere else. Use `--env` when you want the command to resolve `development`, `test`, or `production` from the same file. Use explicit flags such as `--db`, `--dialect`, or `--dir` when you need a one-off override.

## Multi-database applications

Tango does not impose a database routing policy, so multi-database work should stay explicit in application code.

The safest pattern is to centralize:

- connection names
- adapter selection
- manager-to-connection mapping
- migration execution per database

That centralization keeps database policy visible and avoids burying connection assumptions deep inside repositories.

## Operational advice

Whichever backend you choose, make these behaviors explicit:

- application startup should fail fast on invalid or missing database configuration
- migration application should happen through a deliberate command or deployment step
- integration tests should cover the backends you claim to support

## Related pages

- [Config API](/reference/config-api)
- [Run Tango in CI/CD](/how-to/ci-cd-pipelines)
- [Generate and apply migrations](/how-to/generate-and-apply-migrations)
- [Testing](/topics/testing)
