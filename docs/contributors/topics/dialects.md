# Dialects in Tango

Database dialects are a first-class contract in Tango because application behavior depends on more than query syntax. DDL semantics, transaction behavior, schema support, index capabilities, and JSON behavior all influence whether model, repository, migration, and testing behavior stays correct.

## What a dialect means

In Tango, a dialect represents one database family and its behavior constraints. That contract informs:

- how adapters connect and execute SQL
- how migrations compile and run
- which schema operations are supported safely
- which integration test expectations are valid

## Where dialect behavior lives

Dialect behavior is distributed across multiple layers, based on domain concern:

- `@danceroutine/tango-orm` connection and query behavior
- `@danceroutine/tango-migrations` introspection, compilation, and execution behavior
- `@danceroutine/tango-testing` harness strategy and conformance behavior

Tango is designed so most application code can remain dialect-agnostic across supported backends. Teams should still account for backend capability differences when defining migration policy, CI coverage, and performance-sensitive query behavior.

In order to support future dialects easily, Tango leverages the [Strategy](https://refactoring.guru/design-patterns/strategy) architectural pattern to enable dialect specific logic to be encapsulated within specific strategy implementations. This enables Tango's core functionalities to remain agnostic to the specific database dialect, and avoids quirks of Database feature implementations polluting the core business logic of Tango.

## How a dialect is represented

A dialect is represented through a set of cooperating contracts across Tango layers.

1. A migrations `Compiler` (with an associated `CompilerFactory`) translates Tango migration operations into dialect-specific SQL instructions.
2. A migrations `Introspector` reads the current database schema so Tango can derive migration operations from model changes.
3. An ORM `Adapter` creates a dialect-specific `DBClient`.
4. A `DBClient` performs the actual connection and query execution against a database instance.
5. An `IntegrationHarness` strategy, surfaced through `TestHarness`, provides repeatable setup, reset, teardown, and conformance behavior for integration testing.

## First-party baseline

Tango currently includes first-party harness strategies for:

- SQLite
- PostgreSQL

New dialects will be onboarded upon request.

## Related pages

- [Onboard a new database dialect](/contributors/how-to/new-dialect-onboarding)
