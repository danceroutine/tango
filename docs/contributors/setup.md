# Contributor setup

This page focuses on local environment setup and validation. It helps you get a clean checkout into a known-good state that matches CI expectations before you begin feature work.

For contribution standards and pull request expectations, check out [Contributing](/contributing). For versioning and package publication, reference [Releasing packages](/contributors/releasing).

## Prerequisites

- Node.js 22 or newer
- pnpm 9 or newer
- Docker for PostgreSQL integration workflows

Tango uses `pnpm` workspace commands throughout the repository. If your local shell resolves a different Node or pnpm version than CI, fix that first because most downstream failures become noisy version mismatches.

## Clone and install

```bash
git clone https://github.com/danceroutine/tango.git
cd tango
pnpm install
```

## Validate a clean checkout

Run the same broad gates that CI relies on:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:integration:all
```

Under normal circumstances, all of those checks should pass immediately on fresh clone. If one of those checks fails, and you have verified your own development environment is properly setup, raise a Github Issue.

## After setup

Once local setup is complete, continue with:

1. [Contributing](/contributing) for engineering standards and pull request workflow
2. [Releasing packages](/contributors/releasing) for changesets and publish flow

## Contributor how-to guides

When you are ready to execute a specific maintainer workflow, use the contributor how-to guides as procedural references:

1. [Contributor how-to guides](/contributors/how-to/)

For architecture and maintainer contract context, use [Contributor topics](/contributors/topics/).
