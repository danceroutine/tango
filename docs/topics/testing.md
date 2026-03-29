# Testing

Tango's testing package exists because framework code and data-layer code usually need more than plain unit mocks.

You often need one or more of these:

- manager and query doubles for fast unit tests
- fixture generation for model-like data
- a repeatable SQLite or PostgreSQL database harness for integration tests
- helper functions that keep migration and schema assertions readable

## Main testing tools

The package provides these top-level tools:

- `aDBClient`
- `aManager`
- `aQueryExecutor`
- `aQuerySet`
- `ModelDataFactory`
- everything from `integration`
- the Vitest helpers from `vitest`

## Mocks

The mocks package is useful when you want to test code that depends on Tango's manager and query contracts without starting a real database.

- `aDBClient`
- `aManager`
- `aQueryExecutor`
- `aQuerySet`

Use them for unit tests around service code, resource classes, and error handling paths.

## Factories

`ModelDataFactory` helps build repeatable test data with defaults and sequence-based overrides.

It supports:

- `build()`
- `buildList()`
- `resetSequence()`
- `getSequence()`

Subclass it when you want custom sequence behavior for one model shape.

## Integration harnesses

`TestHarness` is the main facade for dialect-aware integration test setup.

It supports:

- `TestHarness.sqlite()`
- `TestHarness.postgres()`
- `TestHarness.forDialect(...)`
- strategy registration for new dialects

This is the right tool when you want to run the same contract tests against multiple databases.

When a test needs a real database-backed `QuerySet` for an arbitrary table, `createQuerySetFixture(...)` builds that query surface from a harness plus `TableMeta`.

## Vitest integration

`@danceroutine/tango-testing/vitest` extends `vi` with Tango-specific helpers and adds the `toMatchSchema` matcher.

The helper surface includes:

- `vi.tango.useHarness(...)`
- `vi.tango.getTestHarness()`
- `vi.tango.getRegistry()`
- `vi.tango.assertMigrationPlan(...)`
- `vi.tango.applyAndVerifyMigrations(...)`
- `vi.tango.introspectSchema(...)`
- `vi.tango.seedTable(...)`
- `vi.tango.createQuerySetFixture(...)`
- `vi.tango.expectQueryResult(...)`

## A sensible test pyramid for Tango apps

For most application code:

- use unit tests for pure functions, custom serializers, and manager consumers
- use integration tests for model managers, query behavior, migrations, and dialect differences
- use smoke or end-to-end tests for adapter wiring and the most important endpoints

The standard project scripts already separate unit and integration execution:

- `pnpm test`
- `pnpm test:integration`
- `pnpm test:integration:all`
- `pnpm test:smoke`

## Related pages

- [Testing package README](https://github.com/danceroutine/tango/blob/main/packages/testing/README.md)
- [Run Tango in CI/CD](/how-to/ci-cd-pipelines)
- [New dialect onboarding](/contributors/how-to/new-dialect-onboarding)
