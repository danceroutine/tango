# How to generate and apply migrations

Generating and applying migrations follows the same workflow used by the example applications.

Install `@danceroutine/tango-cli` as a development dependency before you begin. Most applications also keep a `tango.config.ts` file at the project root so the CLI can infer the dialect, database target, and migration directory.

## 1. Export your models from one module

The `make:migrations` command loads a module and collects every exported value that looks like a Tango model.

In the examples, those modules are:

- `examples/blog-api/src/models/index.ts`
- `examples/nextjs-blog/src/lib/models.ts`

## 2. Generate a migration

With `tango.config.ts` at the project root:

```bash
pnpm exec tango make:migrations \
  --config ./tango.config.ts \
  --models ./src/models/index.ts \
  --name add_summary
```

If your config file lives at `./tango.config.ts`, the CLI will auto-load it even when you omit `--config`.

Explicit flags such as `--dialect`, `--db`, and `--dir` override the values inferred from config. Use that path when you need to target a different database or a nonstandard migration directory for a single command.

## 3. Review the generated file

Review the generated file before applying anything so you understand exactly which operations Tango believes are necessary.

`diffSchema()` can detect table, column, and index differences, but generated operations still deserve review, especially around renames and deletions.

Check for:

- unexpected `drop()` calls
- dropped columns you meant to rename
- missing indexes
- incorrect table names caused by a changed namespace or model name

## 4. Apply the migration

```bash
pnpm exec tango migrate --config ./tango.config.ts
```

The examples wrap this in `setup:schema` scripts so the command is easier to reuse.

## 5. Verify status or inspect the SQL plan

To see what would run without applying it:

```bash
pnpm exec tango plan --config ./tango.config.ts
```

To see which migrations are applied:

```bash
pnpm exec tango status --config ./tango.config.ts
```

## 6. Re-run the generation step after applying

Run `make:migrations` again after the migration is applied.

If the database and the model metadata are in sync, the CLI should report no changes.

## Related pages

- [Config API](/reference/config-api)
- [Run Tango in CI/CD](/how-to/ci-cd-pipelines)
- [Migrations topic](/topics/migrations)
- [Configure databases](/how-to/databases)
- [CLI API](/reference/cli-api)
