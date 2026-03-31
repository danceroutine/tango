# @danceroutine/tango-codegen

`@danceroutine/tango-codegen` generates Tango-oriented source files and project scaffolding.

This package automates the repetitive parts of bootstrapping a Tango application while keeping the generated output aligned with Tango's architecture.

## Install

```bash
pnpm add -D @danceroutine/tango-codegen
```

Most application developers will use this package through `@danceroutine/tango-cli`, because the `tango new` workflow is composed there.

## What the package does

The package has two related jobs:

- scaffold full Tango applications for supported host frameworks
- expose programmatic generators and mapping helpers for Tango-shaped source code

The scaffold strategies are the primary public workflow. The lower-level generators are useful when you are building internal automation, editor tooling, or custom project bootstrapping around Tango conventions.

## Scaffolding a project

```bash
tango new my-app --framework express --package-manager pnpm --dialect sqlite
tango new my-nuxt-app --framework nuxt --package-manager pnpm --dialect sqlite
```

Generated applications include:

- `tango.config.ts`
- model definitions that expose `Model.objects`
- adapter-backed CRUD resources
- migration scripts and seed/bootstrap wiring
- host-framework entrypoints that keep Tango-specific setup out of application glue

## Programmatic API example

```ts
import { generateMigrationFromModels, generateModelInterface, generateViewSet } from '@danceroutine/tango-codegen';

const modelSource = generateModelInterface({
    name: 'Post',
    fields: {
        id: { type: 'serial', primaryKey: true },
        title: { type: 'string' },
    },
});

const viewSetSource = generateViewSet('Post');
const migrationSource = generateMigrationFromModels([
    {
        name: 'Post',
        fields: {
            id: { type: 'serial', primaryKey: true },
            title: { type: 'string' },
        },
    },
]);
```

Generated code should still be reviewed and adapted for the application.

## Public API

The root export includes:

- generators such as `generateModelInterface`, `generateMigrationFromModels`, and `generateViewSet`
- mapping helpers such as `mapFieldTypeToTS` and `normalizeFields`
- framework scaffolding types and helpers such as `FrameworkScaffoldRegistry` and `scaffoldProject`
- `registerCodegenCommands()`, which mounts the code-generation command tree into the shared CLI

You can import from the root for normal use, or drill into `domain`, `generators`, `mappers`, `frameworks`, and `commands` when you need a narrower boundary.

## Developer workflow

```bash
pnpm --filter @danceroutine/tango-codegen build
pnpm --filter @danceroutine/tango-codegen typecheck
pnpm --filter @danceroutine/tango-codegen test
```

## Bugs and support

- Documentation: <https://tangowebframework.dev>
- CLI reference: <https://tangowebframework.dev/reference/cli-api>
- Architecture topic: <https://tangowebframework.dev/topics/architecture>
- Issue tracker: <https://github.com/danceroutine/tango/issues>

## License

MIT
