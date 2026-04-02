# How to run Tango in CI/CD

Tango applications are easiest to operate in CI/CD when pipeline jobs follow the same boundaries as the framework:

- configuration comes from `tango.config.ts`
- schema state is managed through migrations
- integration tests run against the same database family you deploy

The sections below give a practical baseline for GitHub Actions and GitLab pipelines, then cover database environments and migration strategy.

## Pipeline shape

A strong default pipeline has three concerns:

1. static verification (`typecheck`, lint, unit tests)
2. integration verification against a real database with migrations applied
3. deployment steps that run migrations once before serving the new build

That separation keeps fast feedback in early jobs while still proving schema compatibility before release.

## GitHub Actions baseline

This workflow runs static checks, then integration tests on both SQLite and PostgreSQL. It assumes pnpm because that matches a common monorepo layout. When your application uses another package manager, replace `pnpm/action-setup`, the `cache` value on `actions/setup-node`, and the install command—for example `npm ci` with `cache: npm`, `yarn install --immutable` with `cache: yarn`, or `bun install --frozen-lockfile` with Bun's caching options.

```yaml
name: ci

on:
    pull_request:
    push:
        branches: [main]

jobs:
    verify:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - uses: pnpm/action-setup@v4
              with:
                  version: 9
            - uses: actions/setup-node@v4
              with:
                  node-version: 22
                  cache: pnpm
            - run: pnpm install --frozen-lockfile
            - run: pnpm typecheck
            - run: pnpm test

    integration:
        runs-on: ubuntu-latest
        strategy:
            fail-fast: false
            matrix:
                dialect: [sqlite, postgres]
        services:
            postgres:
                image: postgres:16
                env:
                    POSTGRES_USER: postgres
                    POSTGRES_PASSWORD: postgres
                    POSTGRES_DB: tango_test
                ports:
                    - 5432:5432
                options: >-
                    --health-cmd "pg_isready -U postgres -d tango_test"
                    --health-interval 10s
                    --health-timeout 5s
                    --health-retries 10
        env:
            NODE_ENV: test
            TANGO_DB_ADAPTER: ${{ matrix.dialect }}
            TANGO_SQLITE_FILENAME: ':memory:'
            TANGO_DATABASE_URL: postgres://postgres:postgres@localhost:5432/tango_test
        steps:
            - uses: actions/checkout@v4
            - uses: pnpm/action-setup@v4
              with:
                  version: 9
            - uses: actions/setup-node@v4
              with:
                  node-version: 22
                  cache: pnpm
            - run: pnpm install --frozen-lockfile
            - run: pnpm exec tango migrate --config ./tango.config.ts --env test
            - run: pnpm test:integration
```

## GitLab pipeline baseline

This `.gitlab-ci.yml` uses a similar structure with `verify` and `integration` stages. The sample activates pnpm through Corepack; replace `before_script` with the install path your project uses if you standardize on npm, Yarn, or Bun instead.

```yaml
stages:
    - verify
    - integration

default:
    image: node:22
    before_script:
        - corepack enable
        - corepack prepare pnpm@9 --activate
        - pnpm install --frozen-lockfile

verify:
    stage: verify
    script:
        - pnpm typecheck
        - pnpm test

integration:postgres:
    stage: integration
    services:
        - name: postgres:16
          alias: postgres
    variables:
        NODE_ENV: test
        TANGO_DB_ADAPTER: postgres
        TANGO_DATABASE_URL: postgres://postgres:postgres@postgres:5432/tango_test
        POSTGRES_USER: postgres
        POSTGRES_PASSWORD: postgres
        POSTGRES_DB: tango_test
    script:
        - pnpm exec tango migrate --config ./tango.config.ts --env test
        - pnpm test:integration

integration:sqlite:
    stage: integration
    variables:
        NODE_ENV: test
        TANGO_DB_ADAPTER: sqlite
        TANGO_SQLITE_FILENAME: ':memory:'
    script:
        - pnpm exec tango migrate --config ./tango.config.ts --env test
        - pnpm test:integration
```

## Database environments

`tango.config.ts` should define stable defaults for `development`, `test`, and `production`, then CI/CD can override specific values per job.

A common pattern is:

- local development: SQLite file for fast iteration
- CI integration: PostgreSQL for production-parity verification
- production: PostgreSQL with deployment-provided connection values

Environment overrides supported by `@danceroutine/tango-config` let pipeline jobs switch behavior without changing application code:

- `TANGO_DB_ADAPTER`
- `TANGO_DATABASE_URL` or `DATABASE_URL`
- `TANGO_SQLITE_FILENAME`
- `TANGO_DB_HOST`, `TANGO_DB_PORT`, `TANGO_DB_NAME`, `TANGO_DB_USER`, `TANGO_DB_PASSWORD`
- `TANGO_MIGRATIONS_DIR`
- `TANGO_MIGRATIONS_ONLINE`

## Migrations in CI

Integration jobs should run migrations against an empty or disposable test database before tests execute:

::: code-group

```bash [npm]
npx tango migrate --config ./tango.config.ts --env test
npm run test:integration
```

```bash [yarn]
yarn exec tango migrate --config ./tango.config.ts --env test
yarn run test:integration
```

```bash [pnpm]
pnpm exec tango migrate --config ./tango.config.ts --env test
pnpm run test:integration
```

```bash [bun]
bunx tango migrate --config ./tango.config.ts --env test
bun run test:integration
```

:::

This catches migration-order problems and schema drift in the same pipeline run that validates behavior.

Useful companion checks in CI:

- `npx tango status --config ./tango.config.ts --env test` (or `yarn exec tango`, `pnpm exec tango`, `bunx tango`) after migrate for applied/pending visibility
- the same prefix with `plan` instead of `status` when you want SQL output as build logs or artifacts

## Migrations in CD

Deployment should treat migrations as a release step, not a background startup side effect.

A practical release sequence is:

1. build and publish the application artifact
2. run `tango migrate` once for the target environment
3. verify migration status
4. shift traffic to the new application version

Typical commands:

::: code-group

```bash [npm]
npx tango migrate --config ./tango.config.ts --env production
npx tango status --config ./tango.config.ts --env production
```

```bash [yarn]
yarn exec tango migrate --config ./tango.config.ts --env production
yarn exec tango status --config ./tango.config.ts --env production
```

```bash [pnpm]
pnpm exec tango migrate --config ./tango.config.ts --env production
pnpm exec tango status --config ./tango.config.ts --env production
```

```bash [bun]
bunx tango migrate --config ./tango.config.ts --env production
bunx tango status --config ./tango.config.ts --env production
```

:::

Running migrations in a single deployment job prevents race conditions when multiple application instances start at the same time.

## Multi-database deployments

When applications use multiple databases, keep migration execution explicit per database target.

A safe pattern is:

- one config profile or override set per database
- one migration command per database in a controlled order
- integration tests that cover every supported database family

That keeps migration policy visible in the pipeline instead of spreading it across application startup paths.

## Related pages

- [Configure databases](/how-to/databases)
- [Generate and apply migrations](/how-to/generate-and-apply-migrations)
- [Migrations](/topics/migrations)
- [Testing](/topics/testing)
