# CLI API

`@danceroutine/tango-cli` provides the `tango` executable and the small programmatic surface behind it.

For most applications, this package is how you run Tango's project setup and migration workflows from the command line. If you need to embed those commands into a custom binary or test harness, the same package also exposes a small module-composition API.

## Install

Install the CLI as a development dependency in an application:

```bash
pnpm add -D @danceroutine/tango-cli
```

The rest of the documentation assumes the `tango` executable is available in your project.

## Built-in commands

Today, the CLI ships with two command groups.

The first group covers project scaffolding:

- `tango new`

The second group covers migrations:

- `tango make:migrations`
- `tango migrate`
- `tango plan`
- `tango status`

That gives one executable a consistent surface for the two workflows most applications reach for first: creating a project and maintaining its database schema.

## Common command-line usage

These are the most common commands:

```bash
tango new my-app --framework express --package-manager pnpm --dialect sqlite
tango make:migrations --config ./tango.config.ts --models ./src/models.ts --name add_posts
tango migrate --config ./tango.config.ts
tango plan --config ./tango.config.ts
tango status --config ./tango.config.ts
```

`tango new` creates a new application scaffold. `tango make:migrations` generates the next migration step from model metadata and the current database schema. `tango migrate` applies pending migrations. `tango plan` shows the SQL Tango would run. `tango status` shows which migration ids the target database has already recorded.

## Config-aware migration commands

The migration commands can auto-load `./tango.config.ts` from the current working directory when that file exists.

When a config file is available, the CLI can infer:

- the dialect from `current.db.adapter`
- the database target from `current.db`
- the migrations directory from `current.migrations.dir`

That inference applies to:

- `tango migrate`
- `tango make:migrations`
- `tango plan`
- `tango status`

Use `--config` when the config file is not at the project root. Use `--env` when you want the command to resolve a different environment from the same config file. Use explicit flags such as `--db`, `--dialect`, or `--dir` when you need a one-off override without changing the config file itself.

## Programmatic API

The root export is small:

- `runCli(options?)`
- `createDefaultCommandModules()`
- `TangoCliCommandModule`

`runCli()` is the programmatic entrypoint used by the `tango` binary itself. If you call it with no custom options, it runs the normal Tango CLI command set.

`createDefaultCommandModules()` returns the standard module list that Tango registers by default.

`TangoCliCommandModule` is the interface for adding another command subtree to the shared parser.

Use this API when you want one binary that includes Tango's built-in commands and your own application-specific commands:

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

In that setup, Tango still supplies its normal command groups, while your application adds its own commands alongside them.

## Related pages

- [Installation](/guide/installation)
- [Getting started](/guide/getting-started)
- [Config API](/reference/config-api)
- [Migrations](/topics/migrations)
- [How to work with models](/how-to/work-with-models)
