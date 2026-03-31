# @danceroutine/tango-cli

`@danceroutine/tango-cli` provides the `tango` command-line executable.

This package gives Tango one unified command surface for project setup and maintenance workflows. It owns the public CLI, while the behavior is composed from domain packages such as migrations and codegen.

## Install

```bash
pnpm add -D @danceroutine/tango-cli
```

Use the `tango` binary when you want to:

- scaffold a new Tango project
- generate migrations from model metadata
- apply migrations to a database
- inspect a migration plan or status

## Common commands

```bash
tango new my-app --framework express --package-manager pnpm --dialect sqlite
tango new my-nuxt-app --framework nuxt --package-manager pnpm --dialect sqlite
tango make:migrations --config ./tango.config.ts --models ./src/models.ts --name add_posts
tango migrate --config ./tango.config.ts
tango plan --config ./tango.config.ts
tango status --config ./tango.config.ts
```

Projects scaffolded through `tango new` use Tango's transparent runtime and `Model.objects` by default, so the generated application code stays focused on models, resources, and host-framework wiring.

## Using the package programmatically

The root export is intentionally small. If you need to embed Tango's CLI into a custom binary or test harness, start with `runCli()` and `createDefaultCommandModules()`:

```ts
import type { Argv } from 'yargs';
import { createDefaultCommandModules, runCli, type TangoCliCommandModule } from '@danceroutine/tango-cli';

class AppCommandModule implements TangoCliCommandModule {
    readonly id = 'app';

    register(parser: Argv): Argv {
        return parser.command(
            'seed-demo-data',
            'Load demo data into the local database',
            () => {},
            async () => {}
        );
    }
}

await runCli({
    modules: [...createDefaultCommandModules(), new AppCommandModule()],
});
```

## Developer workflow

```bash
pnpm --filter @danceroutine/tango-cli build
pnpm --filter @danceroutine/tango-cli typecheck
pnpm --filter @danceroutine/tango-cli test
```

## Bugs and support

- Documentation: <https://tangowebframework.dev>
- Config API: <https://tangowebframework.dev/reference/config-api>
- CLI reference: <https://tangowebframework.dev/reference/cli-api>
- Migrations topic: <https://tangowebframework.dev/topics/migrations>
- Issue tracker: <https://github.com/danceroutine/tango/issues>

## License

MIT
