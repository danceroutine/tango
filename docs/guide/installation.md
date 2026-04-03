# Installation

Before you can build with Tango, you need three things in place:

- a supported Node.js runtime
- a package manager
- a host framework such as Express, Next.js, or Nuxt

Tango is distributed as npm packages, so applications install the packages that match their workflow. We recommend always installing the CLI as part of your normal Tango install path because migration generation, migration application, planning, status checks, and project scaffolding all flow through the `tango` command.

A smaller API application might begin with configuration, the CLI, schema, ORM, migrations, resources, one adapter package, and one database driver. A larger application might also add the testing helpers or OpenAPI support.

## Runtime requirements

Tango currently expects:

- Node.js 22 or newer
- a package manager such as npm, Yarn, pnpm, or Bun

If your application uses PostgreSQL, you also need a PostgreSQL instance available for development and test runs. Docker is a common way to provide that locally, and many Tango examples and maintainer workflows use that approach.

## Install the core Tango packages

Most applications begin with the same core set of packages:

::: code-group

```bash [npm]
npm install zod @danceroutine/tango-config @danceroutine/tango-cli @danceroutine/tango-schema @danceroutine/tango-orm @danceroutine/tango-migrations @danceroutine/tango-resources
```

```bash [yarn]
yarn add zod @danceroutine/tango-config @danceroutine/tango-cli @danceroutine/tango-schema @danceroutine/tango-orm @danceroutine/tango-migrations @danceroutine/tango-resources
```

```bash [pnpm]
pnpm add zod @danceroutine/tango-config @danceroutine/tango-cli @danceroutine/tango-schema @danceroutine/tango-orm @danceroutine/tango-migrations @danceroutine/tango-resources
```

```bash [bun]
bun add zod @danceroutine/tango-config @danceroutine/tango-cli @danceroutine/tango-schema @danceroutine/tango-orm @danceroutine/tango-migrations @danceroutine/tango-resources
```

:::

Those packages cover the main Tango workflow:

- `@danceroutine/tango-cli` for the `tango` command-line workflow, including migration generation, migration execution, planning, status checks, and project scaffolding
- `@danceroutine/tango-config` for `tango.config.ts` and runtime config loading
- `@danceroutine/tango-schema` for model definitions and metadata
- `@danceroutine/tango-orm` for `Model.objects`, `QuerySet`, and database access
- `@danceroutine/tango-migrations` for schema diffing, migration generation, and migration execution
- `@danceroutine/tango-resources` for serializers, API views, generic CRUD views, and viewsets

Tango's normal developer workflow assumes the CLI is present. The rest of this documentation follows that assumption as well, because model changes, migration generation, migration application, and scaffolded project setup all become simpler to work with through the `tango` command.

## Choose your host framework adapter

After the core packages are installed, add the adapter that matches your application runtime.

### Express

::: code-group

```bash [npm]
npm install @danceroutine/tango-adapters-express express
```

```bash [yarn]
yarn add @danceroutine/tango-adapters-express express
```

```bash [pnpm]
pnpm add @danceroutine/tango-adapters-express express
```

```bash [bun]
bun add @danceroutine/tango-adapters-express express
```

:::

### Next.js

::: code-group

```bash [npm]
npm install @danceroutine/tango-adapters-next next react react-dom
```

```bash [yarn]
yarn add @danceroutine/tango-adapters-next next react react-dom
```

```bash [pnpm]
pnpm add @danceroutine/tango-adapters-next next react react-dom
```

```bash [bun]
bun add @danceroutine/tango-adapters-next next react react-dom
```

:::

### Nuxt

::: code-group

```bash [npm]
npm install @danceroutine/tango-adapters-nuxt nuxt vue
```

```bash [yarn]
yarn add @danceroutine/tango-adapters-nuxt nuxt vue
```

```bash [pnpm]
pnpm add @danceroutine/tango-adapters-nuxt nuxt vue
```

```bash [bun]
bun add @danceroutine/tango-adapters-nuxt nuxt vue
```

:::

Nuxt projects that import Tango model modules directly into Nitro handlers or SSR pages should call `registerModelObjects()` from `@danceroutine/tango-orm/runtime` in the model module. Nitro can remove side-effect-only runtime imports during bundling, and the explicit registration keeps `Model.objects` available where application code expects it.

## Choose a database driver

Tango supports more than one backend, but the installation path is easiest to understand if you choose a driver deliberately at the start.

### SQLite

SQLite is a practical starting point for a first Tango application because it keeps setup small and works well for tutorials, local experiments, and many smaller applications.

::: code-group

```bash [npm]
npm install better-sqlite3
```

```bash [yarn]
yarn add better-sqlite3
```

```bash [pnpm]
pnpm add better-sqlite3
```

```bash [bun]
bun add better-sqlite3
```

:::

### PostgreSQL

PostgreSQL is a common choice when you want a service-backed database with a broader schema and index feature set.

::: code-group

```bash [npm]
npm install pg
```

```bash [yarn]
yarn add pg
```

```bash [pnpm]
pnpm add pg
```

```bash [bun]
bun add pg
```

:::

SQLite is a practical default when you are learning the workflow. PostgreSQL becomes the better fit when your application or deployment model calls for a service-backed database.

## Add more Tango packages when you need them

Add the packages below when the workflow they support becomes useful in your application.

### Testing support

::: code-group

```bash [npm]
npm install -D @danceroutine/tango-testing vitest
```

```bash [yarn]
yarn add -D @danceroutine/tango-testing vitest
```

```bash [pnpm]
pnpm add -D @danceroutine/tango-testing vitest
```

```bash [bun]
bun add -d @danceroutine/tango-testing vitest
```

:::

Install the testing package when you want Tango-specific mocks, factories, integration harnesses, or Vitest helpers.

### OpenAPI document generation

::: code-group

```bash [npm]
npm install @danceroutine/tango-openapi
```

```bash [yarn]
yarn add @danceroutine/tango-openapi
```

```bash [pnpm]
pnpm add @danceroutine/tango-openapi
```

```bash [bun]
bun add @danceroutine/tango-openapi
```

:::

Install the OpenAPI package when you want the application to publish a machine-readable API document for Swagger UI, client generation, or external tooling.

## Verify the installation

After the packages are installed, the next step is usually to create `tango.config.ts`, define a model, and wire the chosen adapter into your host framework.

At this point, the most useful verification is practical:

1. create `tango.config.ts`
2. define one model
3. generate or write the first migration
4. run the migration
5. expose the model through one view or viewset

If you want a working reference before you do that in your own application, go back to [Getting started](/guide/getting-started) and run one of the example apps.

## What to read next

Once the packages are installed, continue with the pages that help you assemble a real application:

- [Getting started](/guide/getting-started)
- [Overview](/guide/overview)
- [Configure databases](/how-to/databases)
- [Run Tango in CI/CD](/how-to/ci-cd-pipelines)
- [Auto-document your API](/how-to/auto-document-your-api)
- [Config API](/reference/config-api)
- [CLI API](/reference/cli-api)
