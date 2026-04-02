# Installation

The packages most application developers need are listed here, along with the way the examples in this repository are assembled.

## Runtime requirements

- Node.js 22 or newer
- pnpm 9 or newer

If you want to run PostgreSQL integration tests, you will also need a PostgreSQL instance. The repository uses Docker for that workflow.

## Install only what you need

Tango is split into packages so you can adopt it incrementally.

### Typical API application

```bash
pnpm add zod
pnpm add @danceroutine/tango-config
pnpm add @danceroutine/tango-schema
pnpm add @danceroutine/tango-orm
pnpm add @danceroutine/tango-migrations
pnpm add @danceroutine/tango-resources
```

Then install the adapter and database driver for your stack:

```bash
pnpm add @danceroutine/tango-adapters-express express
pnpm add better-sqlite3
```

or:

```bash
pnpm add @danceroutine/tango-adapters-next next react react-dom
pnpm add better-sqlite3
```

or:

```bash
pnpm add @danceroutine/tango-adapters-nuxt nuxt vue
pnpm add better-sqlite3
```

Nuxt applications that import Tango model source directly into Nitro handlers or SSR pages should call `registerModelObjects()` from `@danceroutine/tango-orm/runtime` in the model module. Nitro can drop side-effect-only runtime imports during bundling, and the explicit registration keeps `Model.objects` available where application code expects it.

For PostgreSQL:

```bash
pnpm add pg
```

### Testing support

```bash
pnpm add -D @danceroutine/tango-testing vitest
```

### OpenAPI document generation

```bash
pnpm add @danceroutine/tango-openapi
```

Install the OpenAPI package when you want the application to publish a machine-readable API document for Swagger UI, client generation, or external tooling.

### CLI support

```bash
pnpm add -D @danceroutine/tango-cli
```

Install the CLI package if you want to run `tango make:migrations`, `tango migrate`, `tango plan`, `tango status`, or `tango new` inside your application workspace. New Tango applications usually install `@danceroutine/tango-cli` and `@danceroutine/tango-config` together so the CLI can infer migration defaults from `tango.config.ts`.

## Package overview

- `@danceroutine/tango-config` exports `defineConfig`, `loadConfig`, the core config types, and the schemas behind `tango.config.ts`.
- `@danceroutine/tango-schema` exports `Model`, `ModelRegistry`, and metadata helpers such as `t`, `m`, `c`, and `i`.
- `@danceroutine/tango-orm` exports the transparent runtime, `Model.objects`, `QuerySet`, `Q`, and lower-level query primitives.
- `@danceroutine/tango-migrations` exports `Migration`, `op`, `MigrationRunner`, `MigrationGenerator`, and schema diffing support.
- `@danceroutine/tango-resources` exports `APIView`, `Serializer`, `ModelSerializer`, generic CRUD views, `ModelViewSet`, `FilterSet`, and paginators.
- `@danceroutine/tango-openapi` exports the OpenAPI generator and schema mappers used to publish a machine-readable API description.
- `@danceroutine/tango-testing` exports mocks, factories, integration harnesses, and Vitest helpers.
- `@danceroutine/tango-cli` exports the `tango` executable plus the programmatic module-composition API behind it.

## Install from a local clone

If you are working from a local clone of Tango:

```bash
pnpm install
pnpm build
```

That builds all workspace packages and makes the examples and docs runnable from the local workspace.

## Verify the installation

These commands are the quickest sanity check:

```bash
pnpm typecheck
pnpm test
```

If you want the full integration matrix:

```bash
pnpm test:integration:all
```

## Choose an example application

If you are deciding where to start:

- Use the Express blog example if you want to see the entire stack in a conventional JSON API.
- Use the Next.js example if you want to see Tango inside App Router route handlers.
- Use the Nuxt example if you want to see Tango inside explicit Nitro server handlers with Nuxt SSR pages.

The example package scripts are already configured:

- `@danceroutine/tango-example-express-blog-api`
- `@danceroutine/tango-example-nextjs-blog`
- `@danceroutine/tango-example-nuxt-blog`

## Related pages

- [Getting started](/guide/getting-started)
- [Quickstart](/guide/quickstart)
- [Configure databases](/how-to/databases)
- [Run Tango in CI/CD](/how-to/ci-cd-pipelines)
- [Publish an OpenAPI document](/how-to/publish-openapi-document)
- [Config API](/reference/config-api)
- [CLI API](/reference/cli-api)
