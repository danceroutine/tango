# Migrations

Tango migrations keep the database schema aligned with your model metadata.

In a typical application, `tango.config.ts` sits next to the migration workflow. It describes the database target and migration directory once, and the `tango` CLI reuses that config when it runs migration commands.

The migration package supports three related jobs:

- describing schema changes with a class-based migration API
- generating migration files from model metadata and database introspection
- applying migrations in a controlled order with a journal table

## The migration API surface

`@danceroutine/tango-migrations` gives application code these main pieces:

- `Migration`
- `op`, `OpBuilder`, and `CollectingBuilder`
- `MigrationRunner`
- `MigrationGenerator`
- `diffSchema`
- SQL compilers and introspectors for PostgreSQL and SQLite

The `tango` executable now lives in `@danceroutine/tango-cli`, which composes the migration commands from this package into the shared Tango CLI.

## Migration classes

Every migration subclasses `Migration` and defines:

- `id`
- `up(m)`
- `down(m)`

The example from the package README is accurate for the current code:

```ts
export default class CreatePosts extends Migration {
    id = '20260302_create_posts';

    up(m) {
        m.run(
            op.table('posts').create((cols) => {
                cols.add('id', (b) => b.serial().primaryKey());
                cols.add('title', (b) => b.string().notNull());
            })
        );
    }

    down(m) {
        m.run(op.table('posts').drop());
    }
}
```

## How generated migrations work

`diffSchema()` compares model metadata with an introspected database schema. It can generate operations for:

- create table
- drop table
- add column
- drop column
- create index
- drop index

The generator then writes those operations into a migration file.

`MigrationGenerator.generate()` throws if there are no operations to write, which prevents empty migration files from being created.

## How migrations are applied

`MigrationRunner` reads files from a directory, sorts them, skips already applied migrations, and records applied migrations in `_tango_migrations`.

`MigrationRunner` also:

- stores a checksum for each applied migration
- wraps non-online PostgreSQL migrations in a transaction
- supports `apply()`, `plan()`, and `status()`

## How the CLI integrates with migrations

`@danceroutine/tango-migrations` exports `registerMigrationsCommands()`, and `@danceroutine/tango-cli` mounts that command tree into the shared `tango` binary.

When `./tango.config.ts` exists, the CLI can infer the dialect, database target, and migration directory from that file. Explicit flags still win when you need a one-off override.

In day-to-day application work, this is the command surface you use:

- `tango migrate`
- `tango make:migrations`
- `tango plan`
- `tango status`

The Tango repository's example applications call the CLI through package scripts wired for that monorepo. In your own project, invoke the local binary with `npx tango`, `yarn exec tango`, `pnpm exec tango`, or `bunx tango` after you install `@danceroutine/tango-cli`, rather than assuming a global install.

## Practical advice

Treat migration generation as the start of review, not the end of it.

You still need to inspect the generated operations, especially if:

- a model or field was renamed
- an index disappeared
- a relation changed
- the migration wants to drop a table or column you expected to keep

## Related pages

- [Config API](/reference/config-api)
- [Run Tango in CI/CD](/how-to/ci-cd-pipelines)
- [Generate and apply migrations](/how-to/generate-and-apply-migrations)
- [CLI API](/reference/cli-api)
- [Schema API](/reference/schema-api)
- [Blog API tutorial](/tutorials/express-blog-api)
