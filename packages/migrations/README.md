# @danceroutine/tango-migrations

`@danceroutine/tango-migrations` manages schema evolution for Tango applications.

This package exists because model metadata and database schema do not stay aligned on their own. Once a project begins to change, teams need a disciplined way to describe schema changes, compare model intent with the actual database, review what will happen next, and apply those changes in a predictable order. Tango keeps that workflow in one package so that migrations remain a first-class part of application development rather than an afterthought bolted onto the ORM.

## Install

```bash
pnpm add @danceroutine/tango-migrations
```

Install the database driver for the dialect you use:

```bash
pnpm add pg
# or
pnpm add better-sqlite3
```

If you want the `tango` executable for generation and apply workflows, also install:

```bash
pnpm add -D @danceroutine/tango-cli
```

## How the migration workflow fits together

The package supports three related jobs:

1. describe schema changes with migration classes and operation builders
2. compare model metadata with a live database schema and generate a migration plan
3. apply migrations in order and record what has already run

That gives you a workflow that moves from intent to review to execution, rather than asking the database schema to evolve through ad hoc scripts.

## Quick start

```ts
import { Migration, op } from '@danceroutine/tango-migrations';

export default class CreatePosts extends Migration {
    id = '20260302_create_posts';

    up(m) {
        m.run(
            op.table('posts').create((cols) => {
                cols.add('id', (b) => b.serial().primaryKey());
                cols.add('title', (b) => b.text().notNull());
            })
        );
    }

    down(m) {
        m.run(op.table('posts').drop());
    }
}
```

This class-based structure is the core of the package. A migration names a change set and defines how to apply it and, when possible, how to reverse it.

## Using the CLI

Most application developers should use this package through the shared `tango` CLI:

```bash
tango make:migrations --dialect sqlite --models ./src/models.ts --dir ./migrations --name add_posts
tango plan --dialect sqlite --dir ./migrations --db ./app.sqlite
tango migrate --dialect sqlite --dir ./migrations --db ./app.sqlite
tango status --dialect sqlite --dir ./migrations --db ./app.sqlite
```

That command surface is provided by `@danceroutine/tango-cli`, but the migration behavior itself still lives in this package.

## Public API

The root export gives you the main concepts you need:

- `Migration`, the base class for migration files
- `op`, `OpBuilder`, and `CollectingBuilder`, which describe migration operations
- `diffSchema()`, which compares model metadata to an introspected schema
- `MigrationGenerator` and `MigrationRunner`
- SQL compilers, introspectors, and dialect strategies for PostgreSQL and SQLite
- `registerMigrationsCommands()`, which mounts the migration command tree into the CLI

The package also exposes subpaths such as `builder`, `runner`, `generator`, `diff`, `compilers`, `introspect`, `strategies`, and `commands` when you want a narrower import boundary.

## Documentation

- Official documentation: <https://tangowebframework.dev>
- Migrations topic: <https://tangowebframework.dev/topics/migrations>
- Generate and apply migrations: <https://tangowebframework.dev/how-to/generate-and-apply-migrations>

## Development

```bash
pnpm --filter @danceroutine/tango-migrations build
pnpm --filter @danceroutine/tango-migrations typecheck
pnpm --filter @danceroutine/tango-migrations test
```

The package also has integration coverage for dialect-specific behavior:

```bash
pnpm --filter @danceroutine/tango-migrations test:integration
```

For the wider contributor workflow, use:

- <https://tangowebframework.dev/contributors/contributing-code>

## License

MIT
