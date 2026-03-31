# Getting started

Tango is a set of TypeScript packages for building data-heavy web applications with a workflow inspired by Django and Django REST Framework.

Tango lives inside a host runtime such as Express, Next.js, or Nuxt and gives you a consistent way to define models, configure environments, query data, manage migrations, expose API endpoints, and test the result.

## Package layers

Most applications start with these packages:

- `@danceroutine/tango-config` for `tango.config.ts`, environment profiles, and runtime config loading
- `@danceroutine/tango-schema` for model definitions and metadata
- `@danceroutine/tango-orm` for `Model.objects`, `QuerySet`, and database adapters
- `@danceroutine/tango-migrations` for schema diffing, migration generation, and migration execution
- `@danceroutine/tango-resources` for `APIView`, generic CRUD views, `ModelViewSet`, filtering, and pagination
- an adapter package such as `@danceroutine/tango-adapters-express`, `@danceroutine/tango-adapters-next`, or `@danceroutine/tango-adapters-nuxt`

You will also see `@danceroutine/tango-openapi` for machine-readable API documents, `@danceroutine/tango-testing` for test helpers, and `@danceroutine/tango-cli` for the unified `tango` command-line workflow.

## The basic workflow

Most Tango applications follow the same order:

1. Define `tango.config.ts` so the application and the CLI share the same database and migration settings.
2. Define a model with Zod and Tango metadata.
3. Query or mutate that model through `Model.objects`.
4. Generate or write migrations so the database matches the model metadata.
5. Run the migration workflow through the `tango` CLI.
6. Expose the model through a view class or viewset.
7. Register the view class with an adapter for your host framework.

The examples in this repository follow that flow, which makes them useful as both tutorials and reference implementations.

## Read the docs the same way Django expects you to

The official Django documentation teaches through four document types: tutorial, topic guide, how-to guide, and reference. Tango uses the same split because each document type answers a different question well.

- Tutorials answer: "How do I build something real?"
- Topic guides answer: "How does this part work and why is it designed this way?"
- How-to guides answer: "How do I complete this task in my project?"
- Reference answers: "What does the API do exactly?"

If you want the background for that structure, compare:

- [Django documentation](https://docs.djangoproject.com/en/stable/)
- [Django REST Framework documentation](https://www.django-rest-framework.org/)

## Suggested reading order

If you are adopting Tango in an application:

1. [Installation](/guide/installation)
2. [Quickstart](/quickstart)
3. [Blog API tutorial](/tutorials/blog-api)
4. [Models and schema](/topics/models-and-schema)
5. [ORM and repositories](/topics/orm-and-repositories)
6. [Resources and viewsets](/topics/resources-and-viewsets)
7. [Migrations](/topics/migrations)
8. [Configure databases](/how-to/databases)
9. [Run Tango in CI/CD](/how-to/ci-cd-pipelines)
10. [Publish an OpenAPI document](/how-to/publish-openapi-document)
11. [CLI API](/reference/cli-api)
12. [Testing](/topics/testing)

If you want to contribute to Tango itself, use the contributor documentation instead of this guide.

## Prerequisites

- Node.js 22 or newer
- pnpm 9 or newer
- Docker if you want to run the PostgreSQL integration tests

If you are working from a local clone of Tango, these commands should all succeed:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm test:integration:all
```

## A practical first exercise

The fastest way to understand Tango is to make one small change across the whole stack.

Use the Express blog example and do this:

1. Run the example application.
2. Add a field to `PostModel`.
3. Generate a migration for the example.
4. Apply the migration with `tango migrate`.
5. Update the resource code if needed.
6. Confirm the field shows up in the API response.

That exercise forces you to touch the same boundaries you will use in a real project.

## Common misunderstandings

- Tango enhances host frameworks such as Express, Next.js, and Nuxt while those frameworks continue to own routing and request lifecycle behavior.
- `Model.objects` is the default application-facing data access path.
- A migration is not optional once model metadata changes.
- `tango.config.ts` is the normal place to define database and migration settings for an application.
- Pagination should use explicit ordering. The examples use `createdAt` or `id` to keep result order stable.

## Related pages

- [Overview](/guide/overview)
- [Supported and unsupported features](/guide/supported-and-unsupported)
- [Configure databases](/how-to/databases)
- [Run Tango in CI/CD](/how-to/ci-cd-pipelines)
- [Publish an OpenAPI document](/how-to/publish-openapi-document)
- [Config API](/reference/config-api)
- [CLI API](/reference/cli-api)
