# Getting started

Tango gives TypeScript applications a Django-inspired developer workflow for managing database schemas and persistence, managing application configuration, building APIs, and testing the result. It works alongside a host framework such as Express, Next.js, or Nuxt, so you keep the runtime you already know while adding a more structured application layer on top of it.

There are two good ways to begin:

- If you want to see Tango in a working project before installing anything into your own application, run one of the example apps in this repository.
- If you already know you want Tango in your own project, continue with [Installation](/guide/installation).

## What Tango adds to your stack

Most Tango applications are built from the same set of concerns.

- `tango.config.ts` gives the application and the CLI one shared source of truth for database and migration settings. You can also leverage it to provide a one stop configuration module for your business logic.
- Models built from the `@danceroutine/tango-schema` API define your business logic data shape, provide lifecycle hooks for persistence, and define relevant database metadata.
- `@danceroutine/tango-orm` provides you the same QuerySet based ORM contract you're used to from Django, backed by an extensible adapter system to enable onboarding new database management systems.
- `@danceroutine/tango-migrations` provides the same onion-skin automatic migration process for deterministically evolving your database schema as you change your models.
- `@danceroutine/tango-resources` exposes familiar DRF-style capabilities such as APIViews, Viewsets, and Serializers to integrate your application business logic to your API layer with minimal boilerplate.
- An adapter package resposible for connecting your resources to the host framework you are using.

## Start with a working Tango application

The example projects in this repository give you an end-to-end view of Tango in a working application before you decide how much of the stack you want to adopt.

To run the examples, you need:

- Git
- Node.js 22 or newer
- pnpm 9 or newer
- a local clone of the Tango repository

On macOS, Linux, or WSL, the following sequence gives you a clean local setup.

Install Git from [git-scm.com](https://git-scm.com/downloads) when you need it.

Install `nvm` using the official install script:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
```

`zsh` users may need to create `~/.zshrc` first with `touch ~/.zshrc`. After the install script finishes, open a new terminal or load your shell profile so the `nvm` command is available.

Then install Node 22, enable Corepack, activate the workspace pnpm version, and clone Tango:

```bash
nvm install 22
nvm use 22
corepack enable
corepack prepare pnpm@9.13.2 --activate
git clone https://github.com/danceroutine/tango.git
cd tango
pnpm install
```

Machines that already have Git, Node 22, and pnpm can start from the clone step:

```bash
git clone https://github.com/danceroutine/tango.git
cd tango
pnpm install
```

## Run the Express example

Begin with the Express blog example for a straightforward introduction to Tango. It is a conventional REST API, so the framework integration stays easy to read while still exposing the full Tango workflow: configuration, models, ORM access, migrations, serializers, viewsets, filtering, pagination, and the Express adapter.

From the root of the Tango repository, prepare the example data first:

```bash
pnpm --filter @danceroutine/tango-example-express-blog-api bootstrap
```

The bootstrap step seeds the example database with users, posts, and comments. The development server also applies migrations automatically to the configured database (configured in the example's `tango.config.ts`), so once the app starts you can focus on the API behavior with the schema already in place.

Then start the development server:

```bash
pnpm --filter @danceroutine/tango-example-express-blog-api dev
```

When the server is running, open these URLs:

- `http://localhost:3000/health`
- `http://localhost:3000/api/posts?limit=20&offset=0`
- `http://localhost:3000/api/posts?published=true&ordering=-createdAt`

The health endpoint confirms that the application booted successfully. The posts endpoints show pagination, filtering, and ordering against real seeded data, which makes it easier to see how Tango resources expose a predictable query surface.

After you have clicked through the endpoints, we recommend checking out the code in this order: the post model, the repository, the serializer, the viewset, and the Express bootstrap code. That path shows how Tango's persistence and API layers connect to a conventional JSON API server.

## Run the Next.js example

Move to the Next.js example when you want to see the same Tango primitives inside App Router route handlers. It is a good fit for readers whose application already depends on React and Next.js and who want Tango to supply the persistence and API layers inside that environment.

Prepare the seeded content first:

```bash
pnpm --filter @danceroutine/tango-example-nextjs-blog bootstrap
```

The bootstrap script fills the example database with many posts so pagination and listing behavior are visible immediately.

Then start the development server:

```bash
pnpm --filter @danceroutine/tango-example-nextjs-blog dev
```

When the app is running, open:

- `http://localhost:3001/`
- `http://localhost:3001/api/posts?limit=20&offset=0`

The home page shows the application in its normal rendered form. The API route lets you see the same model-backed data through Tango's resource layer inside Next.js route handling.

After that, inspect the model definitions, the serializer, the post viewset, and the route handlers. That sequence gives a clear picture of how Tango integrates with Next.js while Next continues to own the application shell and routing model.

## Run the Nuxt example

The Nuxt example shows the same overall pattern in a Vue and Nitro application. It is a good fit when you want to see Tango in a host framework that combines SSR pages, Nitro server handlers, and a Nuxt-managed application shell.

Prepare the example data first:

```bash
pnpm --filter @danceroutine/tango-example-nuxt-blog bootstrap
```

This script seeds the database with enough posts to make list endpoints, pagination, and the OpenAPI document worth inspecting.

Then start the development server:

```bash
pnpm --filter @danceroutine/tango-example-nuxt-blog dev
```

When the app is running, open:

- `http://localhost:3002/`
- `http://localhost:3002/api/posts?limit=20&offset=0`
- `http://localhost:3002/api/openapi`

The root page shows the Nuxt application as a user sees it, powered by the same ORM layer. If you'r interested in the Nitro API side, check out the posts endpoint to learn about Tango's API behavior in Nuxt. Additionally, the OpenAPI endpoint shows how Tango's API layer can also drive machine-readable self-documenting API output in the same application.

After that, inspect `nuxt.config.ts`, the Tango server handlers, the post serializer, the post viewset, and the Nuxt pages. That path shows how Tango can power the data and API layer while Nuxt continues to shape the user-facing application.

## What to look for in every example

As you move through any of the examples, keep this sequence in mind:

1. `tango.config.ts` selects the database and migration settings.
2. A model definition describes data shape and schema metadata, and works in conjunction with the migration API to keep the database schema aligned with the model metadata.
3. Models expose their ORM query entry via the `<Model>.objects` interface, same as Django, but with the added type-safety that TypeScript enables.
4. Serializers give you an opportunity to define arbitrary or model-driven validation and two-way serialization to and from arbitrary JSON data and Tango models.
5. Viewsets or APIViews define the HTTP-facing contract.
6. Last of all, an adapter connects those Tango abstractions to the host framework.

Once that sequence feels familiar, the rest of the documentation becomes much easier to place because the same workflow shows up across the framework.

## A practical first exercise

One small change across the whole stack is a useful way to build intuition.

Use the Express example and do this:

1. Add a field to `PostModel`.
2. Generate a migration for the example.
3. Apply the migration with `tango migrate`.
4. Update the serializer or resource code if the new field belongs in the API contract.
5. Confirm that the field appears in the API response.

That exercise touches the same boundaries you will use in a real Tango project: schema metadata, migrations, runtime persistence, and API exposure.

## Continue from here

Once you have seen a working Tango application, the usual next steps are:

1. [Installation](/guide/installation) if you are adding Tango to your own application
2. [Overview](/guide/overview) if you want to understand how the documentation is organized
3. A tutorial for your use case:
   [Express blog API](/tutorials/express-blog-api),
   [Next.js blog](/tutorials/nextjs-blog),
   or [Nuxt blog](/tutorials/nuxt-blog)
4. the topic guides to learn more about the capabilities you plan to use most heavily
5. the how-to guides to dig into a self-contained functionality or workflow you plan to layer into your application development.

If you want to work on Tango itself, continue with the [Contributor documentation](/contributors/). Those pages cover setup, contribution workflow, and release operations.

## Related pages

- [Installation](/guide/installation)
- [Overview](/guide/overview)
- [Supported and unsupported features](/guide/supported-and-unsupported)
- [Configure databases](/how-to/databases)
- [Run Tango in CI/CD](/how-to/ci-cd-pipelines)
- [Auto-document your API](/how-to/auto-document-your-api)
