# CLI API

`@danceroutine/tango-cli` is the package that provides Tango's `tango` executable and the small programmatic surface behind it.

`@danceroutine/tango-cli` does not implement migrations or scaffolding by itself. It composes command modules from packages such as `@danceroutine/tango-migrations` and `@danceroutine/tango-codegen` into one consistent command-line entrypoint.

## When to install it

Install `@danceroutine/tango-cli` in an application when you want to:

- run migrations through the `tango` binary
- generate migrations from model metadata
- scaffold a new Tango project
- embed Tango's command set into a custom binary or test harness

```bash
pnpm add -D @danceroutine/tango-cli
```

Most application code imports schema, ORM, resources, and adapters directly. The CLI package is usually a development dependency because it supports project setup and maintenance workflows.

## Command surface

The package publishes the `tango` binary. Today, the built-in command modules register two command groups:

- migration commands from `@danceroutine/tango-migrations`
- project scaffolding commands from `@danceroutine/tango-codegen`

That means these commands are available through one executable:

```bash
tango migrate --dialect sqlite --dir ./migrations --db ./app.sqlite
tango make:migrations --dialect sqlite --models ./src/models.ts --dir ./migrations --name add_posts
tango plan --dialect sqlite --dir ./migrations --db ./app.sqlite
tango status --dialect sqlite --dir ./migrations --db ./app.sqlite
tango new my-app --framework express --package-manager pnpm --dialect sqlite
```

The `new` command is also exposed under `codegen new`. The top-level command exists so that application bootstrapping feels like the first thing the CLI knows how to do.

## Configuration-aware commands

Migration commands auto-load `./tango.config.ts` when that file exists in the current working directory. That allows the CLI to infer:

- the dialect from `current.db.adapter`
- the database target from `current.db`
- the migrations directory from `current.migrations.dir`

These commands all participate in that workflow:

- `tango migrate`
- `tango make:migrations`
- `tango plan`
- `tango status`

Use `--config` when the config file is not at the project root. Use `--env` when you want the command to resolve a different environment from the same file. Use explicit flags such as `--db`, `--dialect`, or `--dir` when you need a one-off override that should not change the config file itself.

## Exports

The root export includes:

- `runCli()` runs the parser with either the built-in modules or a caller-supplied module list.
- `createDefaultCommandModules()` returns the standard module set that ships with Tango.
- `CodegenCommandModule` mounts the scaffolding command tree from `@danceroutine/tango-codegen`.
- `MigrationsCommandModule` mounts the migration command tree from `@danceroutine/tango-migrations`.
- `TangoCliCommandModule` describes the interface a custom command module must implement.

If you want the normal Tango CLI behavior, call `runCli()` and do not pass custom modules. If you want to extend the command set, start from `createDefaultCommandModules()` and append your own modules.

## Embedding the CLI programmatically

The programmatic API is useful when you want one binary that includes Tango commands plus application-specific commands.

```ts
import type { Argv } from 'yargs';
import { createDefaultCommandModules, runCli, type TangoCliCommandModule } from '@danceroutine/tango-cli';

class AppCommandModule implements TangoCliCommandModule {
    readonly id = 'app';

    register(parser: Argv): Argv {
        return parser.command(
            'seed-demo-data',
            'Load demo records into the local database',
            () => {},
            async () => {
                // application-specific command logic
            }
        );
    }
}

await runCli({
    modules: [...createDefaultCommandModules(), new AppCommandModule()],
});
```

This composition model keeps Tango's command surface modular. The CLI package owns parser setup and module registration, while each feature package continues to own its own commands.

## Package boundaries

- `@danceroutine/tango-migrations` owns migration generation, planning, and execution behavior.
- `@danceroutine/tango-cli` owns the top-level executable that exposes those workflows to developers.

If a migration command's behavior changes, you will usually be reading code in the migrations package. If the top-level command composition changes, you will usually be reading code in the CLI package.

## Related pages

- [Installation](/guide/installation)
- [Getting started](/guide/getting-started)
- [Config API](/reference/config-api)
- [Migrations](/topics/migrations)
- [Generate and apply migrations](/how-to/generate-and-apply-migrations)
