# How to work with models

Most model changes in Tango lead to one or more follow-up tasks. For instance, you may need to decide where write-time behavior belongs or bring the database schema back into line with the model metadata as your models evolve.

Those tasks are related, and each one belongs to a different layer of the framework. Keeping them separate makes model changes easier to review and helps you choose the right Tango layer for each responsibility.

## Start by classifying the change

The first question is whether the change affects write behavior, schema shape, or both.

When you have business logic around the lifecycle of a model record, you should consider moving the logic into model hooks so that it is consistently applied to all write paths that go through `Model.objects`. This is particularly useful when you want to enforce a behavior that should hold across more than one endpoint.

When you make changes that affect field definitions, relation metadata, indexes, table names, or any other part of the model contract that the database must store, you'll need to generate and apply a migration after making the change.

Many model changes involve more than one step. Adding a `slug` field, for example, may require a schema change, a migration, and a hook that fills the value on create.

## Moving shared record lifecycle logic into model hooks

Model hooks are the place to express behavior that belongs to the lifecycle of the record itself. Timestamp stamping, slug generation, persisted defaults, and normalization rules belong here when they should happen every time a record is created or updated through the model manager.

A common sign that a rule belongs on the model is that it first appears in one endpoint or script, then turns out to be necessary everywhere the same record can be created or updated.

### Define the rule on the model

Suppose your application includes a blog post model. Each blog post should receive a slug and timestamps when it is created, and should refresh `updatedAt` when it changes. That kind of lifecycle behavior belongs on the model because the same rule should apply in every part of the application that creates or updates blog posts.

```ts
export const PostModel = Model({
    namespace: 'blog',
    name: 'Post',
    schema: PostReadSchema,
    hooks: {
        async beforeCreate({ data }) {
            const now = new Date().toISOString();

            return {
                ...data,
                slug: data.slug ?? slugify(String(data.title)),
                createdAt: now,
                updatedAt: now,
            };
        },
        async beforeUpdate({ patch }) {
            return {
                ...patch,
                updatedAt: new Date().toISOString(),
            };
        },
    },
});
```

Once the rule lives in `hooks`, any code that creates or updates a blog post through `PostModel.objects` applies the same slug and timestamp behavior. That gives the model one shared place to define what should happen when a blog post is written.

### Keep the model responsible for this kind of write-time behavior

Keep model hooks focused on behavior that changes the stored record itself. In this example, the model is responsible for generating the slug and maintaining the timestamps whenever a blog post is created or updated.

That is useful because the rest of the application no longer needs to generate those values before writing the record. Code that creates or updates blog posts can rely on the model to handle that work consistently.

### Verify that blog posts now behave the same way across writes

After moving this behavior onto the model, test the parts of the application that create or update blog posts. You are looking for one outcome: whether a blog post was saved from an API endpoint, a custom action, a script, or a direct call to `PostModel.objects`, the saved record should still receive the slug and timestamp behavior you defined on the model.

Common places to check include:

- API create and update requests
- custom actions that call `PostModel.objects.update(...)`
- scripts that call `PostModel.objects.create(...)`
- tests that use `PostModel.objects` directly

If you only changed model hooks, you can usually stop here. The database schema itself has not changed, so there is no migration work to follow.

## Migrate schema changes

A migration is the checked-in description of how the database schema should change so that the real tables, columns, relations, and indexes still match the model metadata in your code.

You need a migration when your model change affects what the database must store. Without that step, the code and the database drift apart: the model says one thing exists, while the live schema still reflects the older version.

The practical decision is straightforward. If your change alters the shape of the stored schema, generate a migration. If your change only alters runtime behavior, such as model hooks or other write-time logic, you usually do not need one.

Changes that usually require a migration include adding or removing a field, changing a foreign key or relation, renaming a model, namespace, or table, and adding or removing an index.

### Export your models from one module

`tango make:migrations` loads one module and inspects the models exported from it. Most applications keep a single module such as `./src/models/index.ts` that re-exports every model. That gives the command one stable place to read when it compares model metadata to the current database schema.

### Generate the migration

When you run `make:migrations`, Tango compares the model metadata exported from that module with the current database schema and writes a new migration file into the configured migrations directory.

The `--name` flag gives the generated file a human-readable label. It does not need to describe every detail of the change. It only needs to make the migration easy to recognize later during review, deployment, or debugging.

With `tango.config.ts` at the project root, a typical command looks like this:

::: code-group

```bash [npm]
npx tango make:migrations \
  --config ./tango.config.ts \
  --models ./src/models/index.ts \
  --name add_summary
```

```bash [yarn]
yarn exec tango make:migrations \
  --config ./tango.config.ts \
  --models ./src/models/index.ts \
  --name add_summary
```

```bash [pnpm]
pnpm exec tango make:migrations \
  --config ./tango.config.ts \
  --models ./src/models/index.ts \
  --name add_summary
```

```bash [bun]
bunx tango make:migrations \
  --config ./tango.config.ts \
  --models ./src/models/index.ts \
  --name add_summary
```

:::

If the config file lives at `./tango.config.ts`, the CLI will auto-load it even when you omit `--config`.

Explicit flags such as `--dialect`, `--db`, and `--dir` still override the values inferred from config. That is useful when one command needs to target a different database or a different migration directory.

### Review the generated file before you apply it

Generate the migration first, then read the resulting file carefully before you apply anything. Treat it the same way you would treat a hand-written schema change. You should understand which tables, columns, and indexes Tango believes need to change, and you should be comfortable with that interpretation before the migration reaches a real database.

That review matters most when a rename may have been interpreted as a drop plus an add, when a table already contains rows and you are introducing a new required field, when an index or relation changed, or when the migration wants to drop a table or column you expected to keep.

Tango can detect schema differences for you. You still need to decide how to roll out a change that affects existing data, because some changes can ship safely in one migration while others are better handled in two steps, such as adding a column first, backfilling the data, and only then making the field required.

### Apply the migration

Once the generated operations look correct, apply the migration against the target database:

::: code-group

```bash [npm]
npx tango migrate --config ./tango.config.ts
```

```bash [yarn]
yarn exec tango migrate --config ./tango.config.ts
```

```bash [pnpm]
pnpm exec tango migrate --config ./tango.config.ts
```

```bash [bun]
bunx tango migrate --config ./tango.config.ts
```

:::

### Inspect the SQL plan or migration status when you need more confidence

For most model changes, `make:migrations` and `migrate` are the only commands you need. Reach for `plan` and `status` when you want extra confidence during review, debugging, or deployment.

Use `plan` when you want to inspect the SQL Tango would run without applying it. This is especially useful before a production deployment, or any time you want to see the exact statements that the migration runner is preparing to execute:

::: code-group

```bash [npm]
npx tango plan --config ./tango.config.ts
```

```bash [yarn]
yarn exec tango plan --config ./tango.config.ts
```

```bash [pnpm]
pnpm exec tango plan --config ./tango.config.ts
```

```bash [bun]
bunx tango plan --config ./tango.config.ts
```

:::

Use `status` when you want to inspect which migrations are already applied. This is useful when you need to confirm that a deployment environment is up to date, or when you are investigating whether a migration has already run against a given database:

::: code-group

```bash [npm]
npx tango status --config ./tango.config.ts
```

```bash [yarn]
yarn exec tango status --config ./tango.config.ts
```

```bash [pnpm]
pnpm exec tango status --config ./tango.config.ts
```

```bash [bun]
bunx tango status --config ./tango.config.ts
```

:::

### Confirm that the schema is now in sync

Run `make:migrations` again after the migration is applied. When the database schema and the model metadata agree, Tango should report that there are no new changes to write. That final check gives you confidence that the model definition, the generated migration, and the live schema have converged on the same result.

## Related pages

- [Models and schema](/topics/models-and-schema)
- [API layer](/topics/api-layer)
- [Migrations](/topics/migrations)
- [Configure databases](/how-to/databases)
- [Run Tango in CI/CD](/how-to/ci-cd-pipelines)
