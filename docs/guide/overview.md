# Documentation overview

The Tango documentation is organized so that each page answers a different kind of question well.

The structure follows Django's documentation model closely because it works well for a framework with multiple layers.

## Tutorials

Tutorials are for learning by doing. Read them from top to bottom and avoid skipping ahead.

Use a tutorial when you want to see how several Tango packages fit together in one application.

- [Blog API tutorial](/tutorials/blog-api)
- [Next.js blog tutorial](/tutorials/nextjs-blog)
- [Nuxt blog tutorial](/tutorials/nuxt-blog)

## Topic guides

Topic guides explain how a subsystem works, what problems it solves, and where its boundaries are.

Use a topic guide when you already know the task you want to solve but you need a clear mental model first.

- [Architecture](/topics/architecture)
- [Models and schema](/topics/models-and-schema)
- [ORM and repositories](/topics/orm-and-repositories)
- [Resources and viewsets](/topics/resources-and-viewsets)
- [Migrations](/topics/migrations)
- [Testing](/topics/testing)

## How-to guides

How-to guides are task oriented. They assume you already know the broad concepts and need a direct path to one concrete outcome.

- [Configure databases](/how-to/databases)
- [Run Tango in CI/CD](/how-to/ci-cd-pipelines)
- [Publish an OpenAPI document](/how-to/publish-openapi-document)
- [Generate and apply migrations](/how-to/generate-and-apply-migrations)
- [Add filtering](/how-to/filtering)
- [Add pagination](/how-to/pagination)

## Reference

Reference pages answer precise questions about the public API.

- [Config API](/reference/config-api)
- [CLI API](/reference/cli-api)
- [OpenAPI API](/reference/openapi-api)
- [Schema API](/reference/schema-api)
- [ORM query API](/reference/orm-query-api)
- [Resources API](/reference/resources-api)

## A good reading path for new users

If you are new to Tango, use this order:

1. [Getting started](/guide/getting-started)
2. [Installation](/guide/installation)
3. [Quickstart](/quickstart)
4. one tutorial
5. the topic guides for the packages you use
6. how-to guides when you begin changing behavior
7. reference when you need exact method names or contracts

## A good reading path for maintainers

If you work on Tango itself:

1. use the contributor docs for setup and release workflow
2. use the topic guides to validate design intent
3. use the reference pages to keep exports and examples accurate
4. update tutorials whenever the preferred workflow changes
