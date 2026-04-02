# Contributor setup

Whether you're here to write the next chapter of our documentation, fix a bug, or expand Tango's capabilities, everything starts with a working local build. Let's get you up to speed.

## Prerequisites

In order to contribute to Tango, you'll need to have [Git](https://git-scm.com/install/) setup on your machine. We also recommend ensuring you have [nvm](https://github.com/nvm-sh/nvm) installed before proceeding.

Tango leverages modern TypeScript tooling for local development. You'll also need to ensure you are using:

- Node.js 22 or newer
- pnpm 9 or newer

If you're contributing code, you'll also need to install [Docker](https://docs.docker.com/engine/install/) in order to run the database dialect integration tests.

## Clone and install

```bash
git clone https://github.com/danceroutine/tango.git
cd tango
pnpm install
```

## Validate a clean checkout

To ensure your setup was successful, you can run our validation suite.

SQLite integration tests run out of the box. For PostgreSQL integration tests, start the local database first:

```bash
docker compose -f docker-compose.integration.yml up -d
```

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:integration:all
```

Under normal circumstances, all of those checks should pass immediately on fresh clone. If one of those checks fails, and you have verified your own development environment is properly setup, raise a Github Issue.

## After setup

Once local setup is complete, you can choose your adventure:

1. [Contributing code](/contributors/contributing-code)
2. [Writing documentation](/contributors/writing-documentation)
