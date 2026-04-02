# @danceroutine/tango-config

`@danceroutine/tango-config` provides typed, validated application configuration for server-side TypeScript projects.

Tango applications use this package to work with your project's `tango.config.ts`, which serves a similar function to the Django settings module in Django, giving application runtime code one place to read database and migration settings, and gives the `tango` CLI the same source of truth when it infers migration defaults.

## Install

```bash
pnpm add @danceroutine/tango-config
```

`defineConfig()` declares and validates the configuration contract. `loadConfig()` resolves the active environment, loads `.env`, and merges supported Tango environment overrides into the selected environment. The separation keeps configuration declaration and runtime resolution distinct, which makes startup behavior easier to reason about.

## Quick start

```ts
import { defineConfig, loadConfig } from '@danceroutine/tango-config';

const config = defineConfig({
    current: 'development',
    environments: {
        development: {
            name: 'development',
            db: { adapter: 'sqlite', filename: 'dev.sqlite' },
            migrations: { dir: 'migrations', online: false },
        },
        test: {
            name: 'test',
            db: { adapter: 'sqlite', filename: ':memory:' },
            migrations: { dir: 'migrations', online: false },
        },
        production: {
            name: 'production',
            db: { adapter: 'postgres', url: process.env.DATABASE_URL },
            migrations: { dir: 'migrations', online: true },
        },
    },
});

const loaded = loadConfig(() => config);
```

The loaded result is ready for application startup. `loadConfig()` returns the selected environment as `loaded.current`, so application code usually reads `loaded.current.db` and `loaded.current.migrations` directly when it creates database clients or wires migration commands.

## `tango.config.ts`

The usual place to use this package is a project-root `tango.config.ts` file:

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

Application code can then resolve the active environment like this:

```ts
import { loadConfig } from '@danceroutine/tango-config';
import tangoConfig from '../tango.config';

const loadedConfig = loadConfig(() => tangoConfig);
const db = loadedConfig.current.db;
```

## Environment overrides

`loadConfig()` supports environment-driven overrides for Tango database and migration settings, including values such as:

- `TANGO_DB_ADAPTER`
- `TANGO_DATABASE_URL`
- `TANGO_DB_HOST`, `TANGO_DB_PORT`, `TANGO_DB_NAME`, `TANGO_DB_USER`, `TANGO_DB_PASSWORD`
- `TANGO_SQLITE_FILENAME`
- `TANGO_MIGRATIONS_DIR`
- `TANGO_MIGRATIONS_ONLINE`

These overrides are useful when the same application configuration needs to run in local development, CI, and production with different infrastructure values.

## Public API

The root export includes `defineConfig()`, `loadConfig()`, `LoadedConfig`, the core configuration types, and the Zod schemas for Tango config, environments, databases, and migrations.

The root export is enough for most applications. The `schema` and `loader` subpaths are available when you want a narrower import boundary in application code or tooling.

## Documentation

- Official documentation: <https://tangowebframework.dev>
- Config API: <https://tangowebframework.dev/reference/config-api>
- Installation guide: <https://tangowebframework.dev/guide/installation>
- Configure databases: <https://tangowebframework.dev/how-to/databases>

## Development

```bash
pnpm --filter @danceroutine/tango-config build
pnpm --filter @danceroutine/tango-config typecheck
pnpm --filter @danceroutine/tango-config test
```

For the wider contributor workflow, use:

- <https://tangowebframework.dev/contributors/contributing-code>

## License

MIT
