# Tango

Tango is a modern TypeScript web framework that brings the elegance and productivity of Django's design philosophy to the Node.js ecosystem. It encourages rapid development and clean, pragmatic design while leveraging TypeScript's powerful type system for maximum safety and developer experience.

Inspired by [Django](https://github.com/django/django) and Django REST Framework, Tango provides a batteries-included approach to building robust web applications and APIs with TypeScript. Thanks for checking it out.

_Tango is an independent project and is not affiliated with, endorsed by, or sponsored by the Django Software Foundation or the creators of Django REST Framework._

## What Tango Provides

Tango is organized around the same application concerns that shape a Django or Django REST Framework project. Models define structure and metadata, repositories and the ORM handle persistence, migrations keep schema changes explicit and resource classes turn repository behavior into HTTP behavior.

Tango adds adapters to the mix, to connect those resource classes to host frameworks such as Express and Next.js, and ships with the `tango` CLI to tie the developer workflow together.

Tango enhances the frameworks you are already used to with application workflows inspired by Django and is designed to work in tandem with your preferred host framework, without forcing you to migrate away from your chosen tech stack. Express or Next.js continues to own routing and request lifecycle behavior, while Tango provides the application-facing layers for models, persistence, migrations, and API resources.

The main packages you will encounter are `@danceroutine/tango-schema`, `@danceroutine/tango-orm`, `@danceroutine/tango-migrations`, `@danceroutine/tango-resources`, the adapter packages, and `@danceroutine/tango-cli`.

## Documentation

Tango's documentation is organized to help you solve problems from first principles, and will look familiar to Django developers: tutorials for building something concrete, topic guides for learning the architecture, how-to guides for task-oriented work, and reference pages for public contracts.

If you are evaluating Tango, start here:

1. [Getting started](docs/guide/getting-started.md)
2. [Installation](docs/guide/installation.md)
3. [Quickstart](docs/quickstart.md)
4. [Blog API tutorial](docs/tutorials/blog-api.md) or [Next.js tutorial](docs/tutorials/nextjs-blog.md)
5. the topic guides for the packages you plan to use

The full documentation set lives under [`docs/`](docs/), and is hosted on <https://tangowebframework.dev>.

## Example Applications

Tango provides an example application for each supported host framework, viewable under `examples/`

Run the Express example with:

```bash
pnpm --filter @danceroutine/tango-example-express-blog-api bootstrap
pnpm --filter @danceroutine/tango-example-express-blog-api dev
```

Run the Next.js example with:

```bash
pnpm --filter @danceroutine/tango-example-nextjs-blog bootstrap
pnpm --filter @danceroutine/tango-example-nextjs-blog dev
```

The examples are the fastest way to see the full Tango stack in one place: models, repositories, migrations, resources, filtering, pagination, and adapters.

## Working in This Repository

If you are contributing to Tango itself, start with the contributor docs:

1. [Contributor overview](docs/contributors/index.md)
2. [Contributor setup](docs/contributors/setup.md)
3. [Package catalog](docs/contributors/package-catalog.md)
4. [Releasing packages](docs/contributors/releasing.md)
5. [Contributing standards](docs/contributing.md)

### Prerequisites

- Node.js 22 or newer
- pnpm 9 or newer
- Docker if you want to run the PostgreSQL integration suite

### Initial Setup

```bash
git clone https://github.com/danceroutine/tango.git
cd tango
nvm use
pnpm install
```

### Common Commands

```bash
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:integration:all
pnpm build
pnpm docs:dev
pnpm docs:build
```

SQLite integration tests run out of the box. For PostgreSQL integration tests, start the local database first:

```bash
docker compose -f docker-compose.integration.yml up -d
```

## Releases

Tango uses [Changesets](https://github.com/changesets/changesets) for version management and publishing.

Create a changeset when your work should ship in a release:

```bash
pnpm changeset
```

For the full release workflow, use the [releasing guide](docs/contributors/releasing.md).

## Contributing

Issues and pull requests are welcome. Contributor workflow, engineering standards, and release expectations are covered here:

- [Contributor overview](docs/contributors/index.md)
- [Contributing standards](docs/contributing.md)

## License

MIT

## Author

Pedro Del Moral Lopez
