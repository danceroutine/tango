# How to run Tango in CI/CD

A Tango application moves through CI/CD cleanly when the pipeline treats three concerns separately. First, CI should prove that the application code is healthy. Next, it should prove that the checked-in migrations can bring a disposable database into sync before integration tests run. Finally, deployment should run those same migrations once against the target environment before the new release begins serving traffic.

`tango.config.ts` is the center of gravity for that workflow. The same configuration describes database settings for application code and for the `tango` CLI, which means pipeline jobs can change environments through config selection and environment variables instead of maintaining a second deployment-only configuration story.

## Start from one configuration story

Your pipeline becomes easier to reason about when development, test, and production all come from the same `tango.config.ts` file.

```ts
import { defineConfig } from '@danceroutine/tango-config';

export default defineConfig({
    current: (process.env.NODE_ENV || 'development') as 'development' | 'test' | 'production',
    environments: {
        development: {
            name: 'development',
            db: {
                adapter: 'sqlite',
                filename: './.data/app.sqlite',
            },
            migrations: { dir: './migrations' },
        },
        test: {
            name: 'test',
            db: {
                adapter: 'sqlite',
                filename: ':memory:',
            },
            migrations: { dir: './migrations' },
        },
        production: {
            name: 'production',
            db: {
                adapter: 'postgres',
                url: process.env.TANGO_DATABASE_URL,
            },
            migrations: { dir: './migrations' },
        },
    },
});
```

Each environment can still use a different database. The important part is that the pipeline begins from one declared configuration model and overrides only the pieces that really differ at runtime.

That override path is built into `@danceroutine/tango-config`. A CI job can select PostgreSQL over SQLite, or point a production deploy at its real database, by setting environment variables such as:

- `TANGO_DB_ADAPTER`
- `TANGO_DATABASE_URL` or `DATABASE_URL`
- `TANGO_SQLITE_FILENAME`
- `TANGO_DB_HOST`, `TANGO_DB_PORT`, `TANGO_DB_NAME`, `TANGO_DB_USER`, `TANGO_DB_PASSWORD`
- `TANGO_MIGRATIONS_DIR`

With that arrangement, the application and the migration commands keep reading the same Tango configuration contract, even when CI and production inject different connection values.

## Decide which database each environment should prove

Different environments often need different tradeoffs. Local development often benefits from SQLite because it starts quickly and keeps the inner loop simple. Production often benefits from a more feature-rich database such as PostgreSQL because it better matches real connection behavior, locking behavior, and migration characteristics.

CI should reflect the database story you actually deploy.

If production uses PostgreSQL, at least one CI integration job should also use PostgreSQL. That is the job that proves your checked-in migrations still apply cleanly to the same database family you expect to operate in production.

If your application intentionally supports more than one backend family, CI should make that support explicit. Add one integration job per supported family instead of assuming that a SQLite pass is enough to prove PostgreSQL behavior, or the reverse. That extra coverage is worth the effort when production data depends on it.

## Shape the pipeline around three stages

A healthy Tango pipeline usually has three layers.

The first layer is fast verification. That is where typechecking, linting, and unit tests run. These jobs should stay cheap so that contributors get feedback quickly.

The second layer is integration verification. This is where a disposable database is started, migrations are applied, and integration tests run against the migrated schema. That is the stage that tells you whether the application, the migrations, and the database still agree with one another.

The third layer is deployment. Build the release artifact, run migrations for the target environment, verify the migration state, and only then shift traffic to the new build.

That sequence keeps migration execution explicit. The application process should not be responsible for racing other application processes to update the schema during startup.

## Run migrations in CI before integration tests

An integration job should start from an empty or disposable database, apply the checked-in migrations, and then run the tests that exercise the application against that schema.

That order catches a specific class of failures that static checks will never see: missing migrations, broken migration ordering, schema drift between model metadata and the database, and integration bugs that only appear after the real schema has been created.

Once the job has selected the test environment and started its disposable database, run the migration command before the integration suite. With `tango.config.ts` at the project root, the core CI flow looks like this:

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

`--env test` keeps the command aligned with the test environment from `tango.config.ts`, while environment variables can still override the actual adapter or connection details for the job.

`status` is a useful follow-up command when you want the build logs to show which migrations were applied. `plan` is useful when you want SQL output for review or for debugging a failing migration job.

Those commands are optional in every CI run, but they become valuable when a migration failure needs more visibility than a single stack trace.

## Reconcile competing migrations before merge

Larger teams eventually run into a familiar situation. Developer A generates one migration on branch A. Developer B generates another migration on branch B. Both branches later merge.

At that point, focus shifts to the merged migration chain. The relevant question is whether the merged branch now contains one migration sequence that still describes the merged schema accurately.

In Tango, migrations are applied as one ordered chain. Two unrelated migrations can often coexist without trouble after a merge.

The risk appears when both branches changed the same schema surface from different starting assumptions. One branch may rename a column while another branch adds an index to the old column name. One branch may drop a relation while another branch adds a constraint to it. After merge, one of those migrations may no longer describe the right next step.

Schema branches should therefore follow a stricter merge discipline than code-only branches:

1. rebase or merge the latest `main` or release branch before final review
2. rerun `tango make:migrations` when the merged schema changed underneath the branch
3. review the resulting migration chain as one sequence after merge, not as two separate branch outputs
4. prove the merged chain by running `tango migrate` against a clean database in CI

When the branch introduces high-risk schema work, add a second migration check that starts from the schema currently represented by `main`. In practice, that can mean creating a disposable database from the current `main` migration chain first, then applying the branch's additional migrations on top. That check catches migrations that were generated from an older schema snapshot and no longer fit the merged branch cleanly.

## Keep in-development schema changes out of shared staging

One common pattern in CI/CD is to have a shared staging environment that mirrors production. While this helps with testing and development, it can complicate matters when dealing with schema changes. We recommend reserving it for the stable production schema state that the team is integrating, instead of letting unrelated feature branches mutate it at the same time.

The safest approach is to give each branch that changes schema its own preview database. The branch can then apply its migrations, run integration tests, and support QA work without contaminating the schema state that other branches rely on.

You do not need a separate Tango configuration file for every branch to do this. Keep `tango.config.ts` stable and inject branch-specific connection values during preview deployment. In practice, that usually means the preview job supplies a branch-specific `TANGO_DATABASE_URL` and then runs the normal migration command for that deployment.

If full preview environments are too expensive, the next best option is still to isolate the database even if the application host is shared. A branch-specific database or schema gives the team most of the operational safety without requiring a completely separate stack.

If the team truly has only one shared staging database, let one branch that changes schema use it at a time. Everyone else should rely on CI plus isolated local or disposable databases until the staging environment is free again. In that setup, staging serves final integration verification for schema work, while parallel branch experimentation happens elsewhere.

## Run migrations once during deployment

Deployment should apply migrations as a separate and deliberate release step.

That usually means one job or release task runs `tango migrate` against the target environment before the new application version begins serving traffic. Once the migration step succeeds, the release can verify status, finish the build rollout, and only then shift traffic.

The normal production commands are:

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

Running migrations once in a controlled deployment step avoids a common operational problem: multiple application instances starting at the same time and all trying to own schema changes.

Some schema changes also require a more careful rollout than "migrate and deploy immediately." If a change introduces a required column, needs a data backfill, or temporarily requires old and new application versions to coexist, split the rollout into multiple deploys. In practice, that often means adding the new schema first, backfilling data, and only later making the stricter constraint part of the contract.

## GitHub Actions baseline

The following workflow uses pnpm, runs fast verification first, then starts PostgreSQL for the integration job, applies migrations, and finally runs a deployment job on `main`.

Replace the final `pnpm run deploy` step with the deployment command your platform expects. If your application supports more than one backend family, add another integration job and keep each job focused on one backend scenario.

```yaml
name: ci-cd

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

    integration-postgres:
        runs-on: ubuntu-latest
        needs: verify
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
            TANGO_DB_ADAPTER: postgres
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

    deploy:
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        runs-on: ubuntu-latest
        needs: integration-postgres
        env:
            NODE_ENV: production
            TANGO_DATABASE_URL: ${{ secrets.TANGO_DATABASE_URL }}
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
            - run: pnpm exec tango migrate --config ./tango.config.ts --env production
            - run: pnpm exec tango status --config ./tango.config.ts --env production
            - run: pnpm run build
            - run: pnpm run deploy
```

If your project standardizes on npm, Yarn, or Bun, change the install and exec steps accordingly. The pipeline shape stays the same.

In GitHub Actions, store the production connection string as a repository or environment secret such as `TANGO_DATABASE_URL`, then map it into the deploy job's environment the way the example does above.

## GitLab pipeline baseline

The same structure maps naturally to GitLab CI. The example below keeps one `verify` stage, one PostgreSQL-backed integration stage, and one deploy stage.

```yaml
stages:
    - verify
    - integration
    - deploy

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
    needs: ['verify']
    services:
        - name: postgres:16
          alias: postgres
    variables:
        NODE_ENV: test
        POSTGRES_USER: postgres
        POSTGRES_PASSWORD: postgres
        POSTGRES_DB: tango_test
        TANGO_DB_ADAPTER: postgres
        TANGO_DATABASE_URL: postgres://postgres:postgres@postgres:5432/tango_test
    script:
        - pnpm exec tango migrate --config ./tango.config.ts --env test
        - pnpm test:integration

deploy:
    stage: deploy
    needs: ['integration:postgres']
    rules:
        - if: '$CI_COMMIT_BRANCH == "main"'
    variables:
        NODE_ENV: production
    script:
        - pnpm exec tango migrate --config ./tango.config.ts --env production
        - pnpm exec tango status --config ./tango.config.ts --env production
        - pnpm run build
        - pnpm run deploy
```

As with GitHub Actions, replace the final deploy command with the one your hosting environment expects. If you use npm, Yarn, or Bun instead of pnpm, adjust `before_script` and the command invocations without changing the overall job structure.

In GitLab, define `TANGO_DATABASE_URL` as a protected CI/CD variable for the project or environment, then let the deploy job inherit it.

## Related pages

- [Configure databases](/how-to/databases)
- [Migrate schema changes](/how-to/work-with-models#migrate-schema-changes)
- [Migrations](/topics/migrations)
- [CLI API](/reference/cli-api)
- [Testing](/topics/testing)
