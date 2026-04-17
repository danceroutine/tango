# CLI API

`@danceroutine/tango-cli` provides the `tango` executable and the small programmatic surface behind it.

For most applications, this package is how you run Tango's project setup and migration workflows from the command line. If you need to embed those commands into a custom binary or test harness, the same package also exposes a small module-composition API.

## Install

Install the CLI as a development dependency in an application:

::: code-group

```bash [pnpm]
pnpm add -D @danceroutine/tango-cli
```

```bash [npm]
npm install -D @danceroutine/tango-cli
```

```bash [yarn]
yarn add -D @danceroutine/tango-cli
```

```bash [bun]
bun add -d @danceroutine/tango-cli
```

:::

The rest of the documentation assumes the `tango` executable is available in your project.

## Built-in commands

The CLI has three public workflows.

Project creation goes through one command:

- `tango new`

Schema maintenance for an existing Tango application goes through four commands:

- `tango make:migrations`
- `tango migrate`
- `tango plan`
- `tango status`

Relation-typing generation goes through one direct command:

- `tango codegen relations`

That keeps the public command surface centered on the three jobs most applications reach for first: creating a project, maintaining its database schema, and keeping generated relation typing current.

## Common command-line usage

Most application code only touches one scaffold command and a small migration loop.

Use `tango new` when you are creating a project:

```bash
tango new my-app --framework express --package-manager pnpm --dialect sqlite
```

Use the migration commands when the application already exists and the model layer has changed:

```bash
tango make:migrations --config ./tango.config.ts --models ./src/models.ts --name add_posts
tango migrate --config ./tango.config.ts
tango plan --config ./tango.config.ts
tango status --config ./tango.config.ts
```

Use the direct relation command when relation metadata changed but no migration file is needed:

```bash
tango codegen relations --models ./src/models.ts
```

`tango make:migrations` generates the next migration step from model metadata and the current database schema, while also refreshing the generated relation registry for the same model module. Use `tango codegen relations` when relation metadata changed but no migration file is needed. `tango migrate` applies pending migrations. `tango plan` shows the SQL Tango would run. `tango status` shows which migration ids the target database has already recorded.

## Config-aware migration commands

The migration commands can resolve their settings from `tango.config.*` instead of requiring every flag to be passed manually.

The CLI resolves those settings in layers.

First, the CLI looks for `tango.config.*` in the current working directory. If you need to override the default config lookup, `--config` allows you to point it at a different file.

Second, it selects the active environment from that file. By default it uses `current` but you can override the environment by using the `--env` flag to select a different environment from the same config file.

Third, it infers the migration settings from that resolved environment:

- the dialect from `current.db.adapter`
- the database target from `current.db`
- the migrations directory from `current.migrations.dir`

Finally, explicit command-line flags such as `--db`, `--dialect`, or `--dir` override the values inferred from config.

This config-aware behavior applies to:

- `tango migrate`
- `tango make:migrations`
- `tango plan`
- `tango status`

## Programmatic API

Most applications do not need the programmatic API. It exists for tooling authors and applications that want one binary to expose both Tango commands and application-specific commands.

That extension API is built around three exports:

- `runCli(options?)`, which starts the CLI
- `createDefaultCommandModules()`, which returns Tango's built-in command modules
- `TangoCliCommandModule`, which is the interface for one additional command module

Use that surface when you want to keep Tango's built-in commands and add your own command subtree alongside them:

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

In the above toy setup, Tango still supplies `new` and the migration commands, while the application adds `seed-demo-data` through the same parser.

## Related pages

- [Installation](/guide/installation)
- [Getting started](/guide/getting-started)
- [Config API](/reference/config-api)
- [Migrations](/topics/migrations)
- [How to work with models](/how-to/work-with-models)
