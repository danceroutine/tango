# Testing

Testing a Tango application usually means testing more than one layer of behavior.

Some code can be proved with a fast unit test. Some behavior depends on a real database because query compilation, schema changes, or dialect differences are part of the contract. Some failures only appear once the application process, the adapter, and the route wiring are all running together.

Tango's testing support follows those different levels of confidence, so choosing the test boundary comes before choosing the helper that matches it.

## Start by choosing the test boundary

If the behavior is pure application logic, a fast unit test is usually enough.

If the behavior depends on `Model.objects`, query composition, migrations, or backend-specific schema behavior, a real database-backed integration test is usually the right tool.

If the behavior depends on the adapter, request translation, route registration, or full application startup, a smoke test or higher-level integration test is usually the better fit.

That boundary choice matters because Tango spans several layers of a web application. The closer the behavior sits to the database or the host framework, the less valuable a fully mocked test becomes.

## Fast unit tests

Tango's mock helpers exist for tests that want the shape of Tango's contracts without paying the cost of a real database.

That is the right level when application code depends on a model manager or query interface, but the test is really about the application's own branching, error handling, or result handling. In that situation, helpers such as `aManager`, `aQuerySet`, `aDBClient`, and `aQueryExecutor` let the test stay close to Tango's public contracts without pretending to prove real SQL behavior.

This level is a good fit for:

- service objects that call a manager
- resource code with error-handling branches
- logic that reacts to query results but does not need the real database to produce those results

Fast unit tests keep the feedback loop short. They are most valuable when they stay honest about the boundary they are testing.

## Factories and repeatable data

As a test suite grows, the next source of friction is often the data setup rather than the query layer.

`ModelDataFactory` exists so that one model-shaped fixture can be created repeatedly with sensible defaults and predictable variation. That keeps test setup readable and reduces fixture duplication across a suite.

Factories are especially useful when:

- several tests need the same model shape
- you want sequence-based defaults
- the tests care about the content of the data, but not about how the rows reached the database

They fit naturally alongside both unit tests and integration tests.

## Integration tests with a real database

Once the behavior under test depends on real persistence behavior, move to a database-backed integration test.

At that point, Tango's `TestHarness` becomes the useful tool. It creates a dialect-specific test harness around a real database workflow so the test can apply migrations, seed data, run queries, and inspect schema state against an actual backend.

That is the right tool when you need to prove behavior such as:

- model manager reads and writes
- queryset compilation and execution
- migration application
- schema introspection
- dialect-sensitive behavior

At this level, the database is part of the contract. The test is proving that the application and the database behave correctly together.

## Testing across dialects

Tango's integration support is dialect-aware because SQLite and PostgreSQL are not identical environments.

`TestHarness` can provision SQLite and PostgreSQL harnesses today. That makes it possible to run the same class of integration test against more than one backend family when the application needs that confidence.

This matters most when:

- the application supports more than one database backend
- a migration needs confidence against the same backend family used in production
- a query or schema behavior may vary by dialect

For many projects, SQLite is still useful for fast local integration coverage. PostgreSQL is often the stronger reference backend for production-oriented confidence.

## Vitest integration

Tango extends the test runner you are already using with helpers that understand Tango's runtime, ORM, and migration contracts.

In a Vitest-based project, importing `@danceroutine/tango-testing/vitest` registers Tango-specific helpers and assertions so that tests can share harness setup and make clearer assertions about schema and migration behavior.

That helper surface is useful when a suite wants one place to keep the active harness, create query fixtures, seed tables, inspect schema state, or assert migration plans without rebuilding the same glue code in every file.

The result is that Vitest can work more naturally with Tango's runtime, migrations, and ORM contracts.

## Smoke tests and full application behavior

Some failures only show up once the application process is running for real.

Adapter registration, framework bootstrapping, environment loading, and full HTTP routing are all examples of behavior that may pass unit and integration tests while still failing in a live process. For that layer, `AppProcessHarness` gives Tango applications a way to start a real child process and probe the running application from the outside.

These tests are slower, so they usually focus on a smaller number of high-value paths:

- application startup
- migration bootstrapping
- one or two representative endpoints
- route and adapter wiring

They give confidence that the layers you tested separately can still work together in one running application.

## A sensible testing shape for Tango applications

For most Tango applications, the testing story settles into a familiar pattern:

- unit tests for pure logic and isolated consumers of Tango interfaces
- integration tests for ORM behavior, migrations, and dialect-backed persistence
- smoke tests for the application process and adapter wiring

That pattern works well because it matches Tango's architecture. The framework has distinct layers, and the test suite can reflect those layers instead of forcing every kind of confidence into one style of test.

## Related pages

- [Run Tango in CI/CD](/how-to/ci-cd-pipelines)
- [Configure databases](/how-to/databases)
- [ORM and QuerySets](/topics/orm-and-querysets)
- [Migrations](/topics/migrations)
