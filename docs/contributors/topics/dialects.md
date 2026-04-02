# Dialects in Tango

A database dialect in Tango is a contract for backend persistence behavior.

The differences between database management systems are usually most self-evident in SQL syntax differences, but it is important to emphasize that SQL syntax consists of only a single part of a dialect contract. Migration semantics, transaction rules, schema support, index capabilities, JSON behavior, connection setup, and integration test orchestration all influence whether Tango can treat a backend as supported.

Tango endeavors to ensure that most application code can remain largely dialect-agnostic across supported backends, which requires that the ORM layer be able to fluently swap between the various dialects as needed. This necessitates maintainers to layout explicit dialect contracts to enable the framework to make backend-sensitive decisions in the ORM, migrations, testing, config, CLI, and scaffolding layers.

The basics:

- A dialect names one database family and the behavior Tango expects from it.
- The ORM uses the dialect to resolve an `Adapter` and a `DBClient`.
- The migrations layer uses the dialect to compile SQL and introspect live schema.
- The testing layer uses the dialect to provision an `IntegrationHarness` and advertise backend capabilities.
- Config, CLI, scaffolding, and documentation determine whether support is internal-only or first-class.

## Why dialects matter

Two databases can both speak SQL and still require different framework behavior.

PostgreSQL and SQLite make a useful contrast. PostgreSQL supports named schemas, concurrent indexes, and a service-backed runtime that usually needs Docker for repeatable integration execution. SQLite is often exercised in process, has different DDL behavior, and does not expose the same schema model as PostgreSQL. A framework that treats those backends as interchangeable at every layer creates migration, testing, and support risks.

Tango treats a dialect as a first-class framework concern. The dialect tells Tango which runtime path to use, which migration behavior is safe, which conformance expectations are valid, and how maintainers should verify support.

## Runtime contracts

The runtime layer answers the first concrete question in dialect support: given a configured backend name, how does Tango connect to it and what capabilities does that connection expose?

The central runtime contract is the adapter:

```ts
export interface Adapter {
    name: string;
    connect(config: AdapterConfig): Promise<DBClient>;
    features: {
        transactionalDDL: boolean;
        concurrentIndex: boolean;
        validateForeignKeys: boolean;
    };
}
```

This contract does two jobs at once. It gives Tango a stable way to resolve a connection for a named backend, and it advertises the backend features that later layers rely on when they decide which operations are safe. The adapter registry is therefore a core part of the dialect boundary.

When a new dialect is added, the runtime step is ready for review when Tango can resolve the adapter through its normal registry-driven path and produce a working `DBClient` through the same flow that application code and maintainer tooling use.

## Migration compilation and introspection

The migration layer needs a way to express Tango migration operations as backend-specific SQL, and it needs a way to inspect the current schema of a live database so it can compare that state against model metadata.

Those responsibilities are distributed between two main actos:

- a compiler, which translates migration operations into dialect-specific SQL
- an introspector reads the current schema of a live database in order to support deriving the schema deltas that produce migrations.

Compilation and introspection fail in different ways. A backend might compile SQL successfully and still expose incomplete or inaccurate schema introspection. Alternatively, it might introspect tables correctly and still require dialect-specific compilation rules for indexes, defaults, or referential actions. Tango keeps those concerns separate so maintainers can reason about them independently and register each one through the appropriate strategy.

## Integration testing and conformance

Dialect support is not credible until the backend can be exercised through Tango's integration workflow. The testing layer is where Tango turns backend support from a set of implementations into something maintainers can verify repeatedly.

The testing contract centers on the integration harness:

```ts
export interface IntegrationHarness {
    readonly dialect: Dialect | string;
    readonly capabilities: DialectTestCapabilities;
    readonly dbClient: DBClient;
    setup(): Promise<void>;
    reset(): Promise<void>;
    teardown(): Promise<void>;
    migrationRunner(migrationsDir: string): MigrationRunner;
}
```

The harness gives Tango one repeatable way to provision a backend, reset it between tests, tear it down safely, and run migrations in the same environment. `TestHarness` sits on top of those dialect-specific strategies and exposes the default first-party registry that maintainers use in integration work.

The capability flags on the harness define what the test suite is allowed to expect from the backend. Those flags currently cover transaction semantics and backend features that materially affect integration behavior:

- `transactionalDDL` controls whether DDL work can be expected to roll back cleanly inside a transaction
- `supportsSchemas` controls whether schema-qualified workflows are valid
- `supportsConcurrentIndex` controls whether online index creation belongs in the supported backend surface
- `supportsDeferredFkValidation` controls whether deferred foreign-key validation behavior can be exercised
- `supportsJsonb` controls whether JSONB-specific behavior is part of the dialect contract

The harness provides the lifecycle boundary for integration work. Service-backed dialects also need a dialect-specific integration suite and a repeatable container workflow so the capability claims are exercised against a real database. Docker-backed integration execution is part of the maintainer story for PostgreSQL today and is likely to be part of the story for future service-backed dialects as well.

## Support levels shape the maintainer workflow

Not every dialect enters Tango at the same level of support.

Internal conformance support means maintainers can wire the backend into runtime, migrations, and integration testing, and can run the dialect through explicit local and CI workflows. At this level, the dialect may still be absent from public scaffolding, default application configuration, examples, and user-facing documentation.

First-class support means the dialect is exposed through Tango's standard application-facing surfaces. That usually includes typed config, CLI selection, code generation or scaffolding, example coverage, package README updates, and user-facing documentation in addition to the lower-level runtime and testing work.

This distinction is useful because it lets Tango grow backend support incrementally without overstating what is ready for end users. It also helps maintainers review a dialect pull request against the correct standard.

## Where dialect behavior enters Tango

Dialect behavior is distributed across several Tango packages informed by domain-driven design principles, each with a distinct responsibility:

- `@danceroutine/tango-orm` owns adapter resolution, connection behavior, and backend feature flags used during runtime work
- `@danceroutine/tango-migrations` owns SQL compilation, schema introspection, and dialect-aware migration execution
- `@danceroutine/tango-testing` owns harness strategy registration, conformance expectations, and dialect-specific integration execution
- `@danceroutine/tango-config` owns the typed config surface that lets maintainers and applications choose a backend by name
- `@danceroutine/tango-codegen` and the CLI layer decide whether a dialect is part of Tango's first-class public workflow

## Continuing to a new dialect

When you are ready to implement a new backend, continue with [Onboard a new database dialect](/contributors/how-to/new-dialect-onboarding). The how-to guide turns these architectural boundaries into the maintainer workflow for extending them safely.
