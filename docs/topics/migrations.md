# Migrations

Migrations are the checked-in history of your database schema.

When you change a Tango model, a migration records how the database should move from one schema state to the next so that tables, columns, relations, and indexes stay aligned with the model contract in your code.

Migrations are part of normal application development. If models are one source of truth for your data shape, migrations are the history of how that truth changed over time.

The basics:

- `tango make:migrations` creates new migration files from model changes
- `tango migrate` applies pending migration files to a database
- Tango stores applied migration state in `_tango_migrations`
- migration files belong in version control alongside the model changes they represent

## How Tango thinks about migrations

A Tango migration is one step in an ordered migration chain.

Each migration file says, in effect, "starting from the schema state that existed before this file, here is the next schema change." The runner then applies those files in order and records which ones have already been applied.

That gives a Tango application two important things:

- a repeatable way to bring a fresh database up to the current schema
- a checked-in history of how the schema reached its current shape

Without migrations, the models and the real database would drift apart. Application code would describe one schema while the database still contained an earlier one.

## The main commands

Most day-to-day migration work revolves around four commands:

- `tango make:migrations`
- `tango migrate`
- `tango plan`
- `tango status`

`make:migrations` is the command that looks at your current model metadata, compares it to the current database schema, and writes a new migration file when the stored schema needs to change.

`migrate` applies the pending files in order.

`plan` is useful when you want to inspect the SQL that Tango is preparing to run.

`status` is useful when you want to see which migrations the target database believes have already been applied.

The how-to pages cover when to run these commands. The important idea in this topic guide is that they all work from the same migration history.

## Migration files

Migration files are normal TypeScript modules that describe schema changes through a migration class.

A basic migration looks like this:

```ts
import { Migration, op } from '@danceroutine/tango-migrations';

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

The important parts are the migration id and the `up(...)` and `down(...)` methods. `up(...)` describes the schema change that should be applied. `down(...)` describes how to reverse it.

Most application code will generate these files rather than writing them from scratch. Even then, it helps to understand that a migration file is just a declarative description of one schema step.

## Migrations workflow

The workflow begins when a model change alters the database schema.

At that point, run `tango make:migrations`. Tango compares the model metadata in your application with the schema it introspects from the target database, then writes a migration file that describes the next step in the schema history. Migration generation is tied to a real database because Tango needs to measure the gap between the database you have now and the model contract you want to ship.

Once the file has been generated, read it carefully before you apply it. Generation is the first step in review. For straightforward additions, the generated operations may already be the rollout you want. For renames, dropped columns, constraint changes, and any change against a database that already contains data, you need to review whether the generated step is safe for the records that already exist.

When the migration looks correct, run `tango migrate` against a real database. Tango loads the migration files from the configured directory, applies the ones that have not yet been recorded, and writes the applied ids into `_tango_migrations`. That journal table is what allows the same migration directory to be used in development, CI, staging, and production while each database keeps its own record of how far through the chain it has progressed.

The model change and the migration file should then be committed together. Other developers, CI jobs, and deployment environments need both at the same time. If one lands without the other, the application code and the database stop describing the same system.

Version control discipline matters even more when two branches both add migrations. Tango currently uses a linear migration history, so the merged branch has to be reviewed again as one ordered chain. After rebasing or merging, confirm that the migration sequence still describes the merged schema accurately. If it does not, regenerate or adjust the migration before it reaches shared environments.

## Backend differences matter

Migrations describe one schema history, but databases do not all behave the same way while that history is being applied.

Tango currently ships with built-in migration support for SQLite and PostgreSQL. Both can support ordinary application workflows, but they do not have identical operational characteristics.

SQLite is convenient for local development and lightweight testing, but schema changes often involve more table rewriting under the hood. PostgreSQL is usually the stronger reference backend for production-oriented migration behavior.

Those differences matter when you review rollout risk, CI coverage, and deployment strategy. The migration chain may be the same, but the database backend still affects how safely and quickly that chain can be applied.

## Related pages

- [Work with models](/how-to/work-with-models)
- [Run Tango in CI/CD](/how-to/ci-cd-pipelines)
- [CLI API](/reference/cli-api)
- [Schema API](/reference/schema-api)
