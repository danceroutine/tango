# Getting started

Tango gives a TypeScript application a Django-inspired workflow for database schema, persistence, configuration, APIs, and testing. It runs alongside a host framework such as Express, Next.js, or Nuxt, so you keep the runtime you already use and add a structured application layer above it.

The quickest way to understand that workflow is to scaffold a project, run it, and watch one change move through the model, a migration, and the API. The quickstart below does that with Express and SQLite in a few minutes.

## Prerequisites

The quickstart needs Node.js 22 or newer and a package manager. The commands below use pnpm, which Corepack can activate:

```bash
corepack enable
corepack prepare pnpm@9.13.2 --activate
```

npm, Yarn, and Bun also work. Pass your choice to `tango new` with `--package-manager`.

## Scaffold a Tango project

`tango new` generates a complete starter project for the host framework you choose. Create an Express project on SQLite and install its dependencies in one step:

```bash
pnpm dlx @danceroutine/tango-cli new my-app --framework express --dialect sqlite --install
cd my-app
```

The scaffold includes `tango.config.ts`, a `Todo` model with its serializer and viewset, the Express adapter wiring, and an OpenAPI endpoint. `--install` runs the package manager for you; omit it to install the dependencies yourself.

::: tip pnpm 10 and native builds
pnpm 10 and newer wait for your approval before a dependency runs its build scripts. `better-sqlite3` compiles a native binding during that step, so on pnpm 10 approve it once and reinstall before generating migrations:

```bash
pnpm approve-builds
pnpm install
```

Select `better-sqlite3` (and `esbuild`) when prompted. pnpm remembers the choice, so this is a one-time step. On pnpm 9 the binding builds during install with no extra action.
:::

## Generate the first migration and run the app

The generated model needs an initial migration before the database has a table to read and write. Generate it, then start the development server:

```bash
pnpm run make:migrations --name initial
pnpm run dev
```

`make:migrations` reads the `Todo` model and writes a migration file under `migrations/`. `pnpm run dev` applies pending migrations and then starts Express on port 3000.

## See the API

`pnpm run dev` keeps running in the foreground, so leave it running and open a second terminal for the requests below. The scaffolded routes are live:

- `http://localhost:3000/health` confirms the server booted.
- `http://localhost:3000/api/openapi.json` returns the generated OpenAPI document.
- `http://localhost:3000/api/todos` returns the todo collection, which starts empty.

Create a todo, then read it back:

```bash
curl -X POST http://localhost:3000/api/todos \
  -H 'content-type: application/json' \
  -d '{"title": "Write my first Tango model"}'

curl http://localhost:3000/api/todos
```

The list response now includes the todo you created.

## Make one change end to end

Changing a single field exercises the full workflow end to end. Add a `priority` field to the todo and watch it travel from the model to a migration to the API.

Open `src/models/TodoModel.ts` and add `priority` to the read schema and the create schema:

```ts
export const TodoReadSchema = z.object({
    id: z.number(),
    title: z.string().min(1),
    priority: z.number().int().min(1).max(5).nullish(),
    completed: z.coerce.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

export const TodoCreateSchema = z.object({
    title: z.string().min(1),
    priority: z.number().int().min(1).max(5).optional(),
    completed: z.boolean().optional().default(false),
});
```

The read schema marks `priority` with `.nullish()` so it accepts `null`. The todo you created earlier predates the new column, so the database stores its `priority` as `null`, and the list endpoint validates every row it returns against the read schema. The create schema keeps `priority` optional, since a new todo either sets the field or omits it.

`TodoModel` builds its stored schema from `TodoReadSchema`, so adding `priority` there also adds it to the model's stored shape. Generate the migration. If the development server is still running, stop it with Ctrl-C and start it again so the new migration is applied before the server restarts:

```bash
pnpm run make:migrations --name add_todo_priority
pnpm run dev
```

Create a todo that sets the new field, and read it back:

```bash
curl -X POST http://localhost:3000/api/todos \
  -H 'content-type: application/json' \
  -d '{"title": "Ship the priority field", "priority": 1}'

curl http://localhost:3000/api/todos
```

The list now returns both todos: the earlier one with `priority` as `null` and the new one with `priority` set to `1`. The regenerated OpenAPI document at `/api/openapi.json` describes the field as well. That loop, from model to migration to API, is the same one you repeat for real schema work.

## Explore the example applications

For fuller, multi-model applications, the Tango repository ships runnable Express, Next.js, and Nuxt examples. They show the same layers in larger blog APIs with users, posts, comments, and relations.

Set up the workspace once:

```bash
git clone https://github.com/danceroutine/tango.git
cd tango
pnpm install
```

If you still need Node 22 or pnpm, install Node through nvm and activate pnpm with Corepack first:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
nvm install 22
nvm use 22
corepack enable
corepack prepare pnpm@9.13.2 --activate
```

Each example seeds sample data and starts its own development server:

```bash
pnpm --filter @danceroutine/tango-example-express-blog-api bootstrap
pnpm --filter @danceroutine/tango-example-express-blog-api dev
```

The Express example serves on port 3000, the Next.js example on 3001, and the Nuxt example on 3002. Swap the filter to `@danceroutine/tango-example-nextjs-blog` or `@danceroutine/tango-example-nuxt-blog` to run the others. The [tutorials](/tutorials/) walk through these applications in detail.

## What to look for in every Tango app

Whether you scaffold a project or read an example, the same sequence appears:

1. `tango.config.ts` selects the database and migration settings.
2. A model describes the data shape and the schema metadata that migrations keep aligned with the database.
3. `Model.objects` exposes the ORM query entry point, with TypeScript-native typing.
4. Serializers define validation and two-way serialization between JSON and Tango models.
5. Viewsets or API views define the HTTP contract.
6. An adapter connects those Tango abstractions to the host framework.

Once that sequence feels familiar, the rest of the documentation is easier to place.

## Continue from here

- [Installation](/guide/installation) to add Tango to an existing application
- A tutorial for your host framework: [Express](/tutorials/express-blog-api), [Next.js](/tutorials/nextjs-blog), or [Nuxt](/tutorials/nuxt-blog)
- The [topic guides](/topics/) for the layers you use most
- The [how-to guides](/how-to/) for self-contained tasks
- [Supported and unsupported features](/guide/supported-and-unsupported) for the current boundary

To work on Tango itself, continue with the [contributor documentation](/contributors/). Those pages cover setup, contribution workflow, and release operations.

## Related pages

- [Installation](/guide/installation)
- [Overview](/guide/overview)
- [Supported and unsupported features](/guide/supported-and-unsupported)
- [Configure databases](/how-to/databases)
- [Run Tango in CI/CD](/how-to/ci-cd-pipelines)
- [Auto-document your API](/how-to/auto-document-your-api)
