# How to configure databases

Tango reads database settings from `tango.config.ts`. Before models, queries, and migrations can do useful work, you need a database that is running and a Tango environment that points at it.

Tango currently supports SQLite and PostgreSQL as built-in relational databases.

## Choose SQLite or PostgreSQL

The first decision is which database should back the application.

SQLite is a good fit when you want the quickest local setup, when you are building a small application, or when you want tests to run against an isolated database file or an in-memory database. PostgreSQL is a better fit when the application will deploy in production on PostgreSQL, when you want migration testing to reflect production more closely, or when the application will benefit from a server-based database from the beginning.

If you expect to deploy on PostgreSQL, it is wise to use PostgreSQL in at least one non-production environment as well. That gives you earlier feedback on migration behavior, connection settings, and database-specific constraints.

## Get the database running

Before Tango can connect, the database itself needs to exist and accept connections.

### SQLite

SQLite does not need a separate server process. In practice, getting SQLite running usually means deciding where the database file should live.

In many Tango applications, development uses a persistent file and tests use an in-memory database:

```ts
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
```

`./.data/app.sqlite` gives local development one persistent database file. `:memory:` creates a temporary database for the lifetime of the process, which is often convenient for tests.

Once you have decided on the filename, there is usually nothing else to install before you run `tango migrate`.

### PostgreSQL

PostgreSQL needs a running server, a database, and credentials that Tango can use.

Before you configure Tango, make sure you have:

- a PostgreSQL server running locally, in Docker, or in your target environment
- a database created for the application
- a database user that can connect to that database
- enough database permissions for `tango migrate` to create and alter tables

For local development, a simple setup often starts with `psql`:

```sql
CREATE USER tango_app WITH PASSWORD 'change-me';
CREATE DATABASE tango_app OWNER tango_app;
```

Once the server is running and those credentials work, Tango can connect through either a single connection URL or discrete fields such as `host`, `port`, `database`, `user`, and `password`.

## Put the connection into `tango.config.ts`

After the database is running, declare how each Tango environment should reach it.

Generated Tango projects already use one `tango.config.ts` file for `development`, `test`, and `production`:

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

This arrangement keeps the application's database policy in one place. Development can stay on SQLite, tests can stay isolated, and production can point at PostgreSQL while the runtime and the CLI continue to read the same configuration file.

If your PostgreSQL environment exposes separate fields instead of a URL, the production environment can use this shape instead:

```ts
production: {
    name: 'production',
    db: {
        adapter: 'postgres',
        host: process.env.TANGO_DB_HOST,
        port: 5432,
        database: process.env.TANGO_DB_NAME,
        user: process.env.TANGO_DB_USER,
        password: process.env.TANGO_DB_PASSWORD,
        maxConnections: 20,
    },
    migrations: { dir: './migrations', online: true },
},
```

## Let the runtime and CLI share the same settings

Application code and Tango's CLI both read from the same project config.

At runtime, application startup usually loads the config and reads `loaded.current.db`:

```ts
import { loadConfig } from '@danceroutine/tango-config';
import tangoConfig from '../tango.config';

const loadedConfig = loadConfig(() => tangoConfig);
const db = loadedConfig.current.db;
```

The CLI follows the same environment selection. When `./tango.config.ts` exists at the project root, commands such as `tango migrate` and `tango make:migrations` can infer the selected database adapter, the database target, and the migrations directory from the current environment.

That shared configuration is one of the reasons it is worth keeping database settings in `tango.config.ts` instead of scattering them between application bootstrap code and shell scripts.

## Override environment-specific details

`loadConfig()` loads `.env` automatically and then merges Tango-specific environment overrides into the selected environment.

That lets `tango.config.ts` describe the normal shape of the application while CI and deployment supply the values that change from one environment to another. The most common pattern is to keep PostgreSQL in the config and inject the real connection string through `TANGO_DATABASE_URL` or `DATABASE_URL`.

When your environment does not provide one URL, Tango can override the connection one field at a time through `TANGO_DB_HOST`, `TANGO_DB_PORT`, `TANGO_DB_NAME`, `TANGO_DB_USER`, and `TANGO_DB_PASSWORD`. SQLite projects can redirect the database file with `TANGO_SQLITE_FILENAME`. Migration behavior can also be adjusted per environment with `TANGO_MIGRATIONS_DIR` and `TANGO_MIGRATIONS_ONLINE`.

For example, a project might keep SQLite in `development`, point `production` at PostgreSQL, and let CI override the `test` environment with `TANGO_DATABASE_URL` so integration tests run against a disposable PostgreSQL database.

## Related pages

- [Config API](/reference/config-api)
- [Run Tango in CI/CD](/how-to/ci-cd-pipelines)
- [Migrate schema changes](/how-to/work-with-models#migrate-schema-changes)
- [Testing](/topics/testing)
