# Onboard a new database dialect

Adding a database dialect to Tango is a cross-package maintenance task. A complete onboarding gives Tango one coherent path for naming the dialect consistently, creating a working runtime connection, compiling and introspecting migrations correctly, exercising the backend through the integration harness, and documenting the supported workflow clearly enough for the next maintainer to follow it.

Read [Dialects in Tango](/contributors/topics/dialects) first if you want the architectural context behind the layers involved. Use this guide when you are ready to implement the change.

## Decide what level of support you are adding

Dialect work in Tango usually lands at one of two support levels, and the rest of the guide becomes much easier once you name that target up front.

Internal conformance support means maintainers can run dialect-specific runtime, migration, and harness validation through explicit wiring and controlled CI coverage. At this level, public scaffolding and default application configuration may still remain unchanged.

First-class support means the dialect is available through Tango's normal application-facing surfaces. That usually includes typed config, CLI selection, scaffolding defaults, examples, and user documentation in addition to the lower-level runtime and testing work.

Write the target support level in the pull request description before you begin implementation. That decision affects which steps below are required immediately and which steps can be deferred intentionally.

## Know what “done” means before you start

Treat the onboarding as complete only when the dialect works across the contracts that own database behavior in Tango:

1. Tango can name the dialect consistently anywhere dialect choice is part of the contract.
2. The ORM can resolve a dialect-specific `Adapter` and return a working `DBClient`.
3. Migrations can compile operations and introspect a live schema for the dialect.
4. The integration testing layer can provision the backend repeatably through a `HarnessStrategy` and `IntegrationHarness`, and a dialect-specific integration suite exercises the advertised capabilities.
5. Maintainer workflows can select the dialect through documented config or explicit wiring.
6. CI can run the dialect reproducibly.
7. Contributor and user docs accurately describe the support boundary.

If one of those conditions is still false, the onboarding is still partial and should be described that way in the pull request.

## 1. Add the dialect name to Tango's explicit contracts

Begin by teaching Tango how to identify the new dialect everywhere dialect choice is represented as a typed contract. This keeps package boundaries aligned before you start adding behavior.

The most common update points are:

- `packages/testing/src/integration/domain/Dialect.ts`
- `packages/migrations/src/domain/internal/InternalDialect.ts`
- `packages/orm/src/query/domain/internal/InternalDialect.ts`
- `packages/config/src/schema/internal/InternalAdapterName.ts`
- `packages/config/src/schema/AdapterName.ts`

We try to avoid hardcoded unions in the codebase, but nonetheless it's worth double checking for any remaining hardcoded unions or enum-like objects that still assume only PostgreSQL and SQLite. A dialect onboarding becomes fragile quickly when one package accepts the new dialect name but another package still rejects it later in the workflow.

## 2. Add the ORM runtime path

Once Tango can name the dialect consistently, add the runtime path that turns that name into a working connection.

In practice, this runtime step usually includes three concrete changes:

1. implementing a dialect `Adapter`
2. implementing or reusing a dialect-specific `DBClient`
3. registering the adapter in the default adapter registry used by normal runtime code

The important runtime seam is `packages/orm/src/connection/adapters/AdapterRegistry.ts`. `connectDB(...)` resolves adapters from that registry, and the process-default runtime eventually flows through that same adapter resolution path after config loading.

When you implement the adapter, keep the database capability flags accurate. Tango relies on adapter capabilities such as transactional DDL, concurrent index support, and foreign-key validation behavior when deciding which operations are safe for a backend.

## 3. Keep config-driven runtime resolution aligned

Runtime support is only useful to maintainers when the normal config flow can select the new dialect intentionally.

For first-class support, make sure the dialect is accepted by Tango config through `packages/config/src/schema/AdapterName.ts` and the corresponding internal adapter-name contract. Then confirm that the runtime path created by `packages/orm/src/runtime/defaultRuntime.ts` can load config and connect with dialect-specific behavior staying inside the adapter layer.

For internal conformance support, decide whether maintainers will use typed config, direct adapter wiring, or both. Whichever path you choose, document it in the pull request and in this guide if the maintainer workflow changes materially.

## 4. Add migrations compilation and introspection

Tango's migration layer needs two dialect-specific capabilities before the backend is usable in schema workflows.

The first capability is SQL compilation. Add a compiler implementation and factory, then register it in `packages/migrations/src/strategies/CompilerStrategy.ts` so the default migration runner can resolve it for the new dialect.

The second capability is schema introspection. Add a dialect-aware introspector and register it in `packages/migrations/src/strategies/IntrospectorStrategy.ts`. Introspection is what allows Tango to diff live schema state against model metadata and is also used by testing helpers that validate migration results.

At this stage, a maintainer should be able to reason about both directions of the migration workflow: Tango can generate SQL for the dialect, and Tango can inspect a real database that already uses the dialect.

## 5. Add the integration harness strategy

After the runtime and migration layers can talk to the backend, add the integration harness that lets tests exercise the dialect repeatably.

Create a `HarnessStrategy` that returns an `IntegrationHarness`, then register it with `packages/testing/src/integration/TestHarness.ts` when the dialect should participate in Tango's default first-party test harness registry.

The harness should make each lifecycle step reliable for maintainers:

- `setup()` prepares a database that migrations and repository tests can use immediately
- `reset()` returns the backend to a known baseline for the next test
- `teardown()` releases resources cleanly, including error paths
- `migrationRunner(...)` works predictably after setup

Set `DialectTestCapabilities` to match the real backend behavior in `packages/testing/src/integration/domain/IntegrationHarness.ts`. Those capability flags are part of the testing contract because conformance expectations are gated by them.

## 6. Add a dialect integration suite and container workflow

After the harness exists, add a dialect-specific integration suite that exercises the backend through real runtime and migration flows. Harness lifecycle tests cover setup, reset, and teardown behavior, while the integration suite validates the dialect capabilities against the database itself.

The suite should cover the behaviors the dialect advertises through its capability flags and adapter features. In practice, that usually means exercising schema creation and teardown, migration compilation and execution, introspection, repository behavior, and dialect-specific capabilities such as transactional DDL, schemas, concurrent indexes, deferred foreign-key validation, or JSON support where those features apply.

This step usually includes:

1. a dialect-specific integration command following the existing `test:integration:<dialect>` pattern in `package.json`
2. any environment variables the dialect needs for adapter resolution
3. a repeatable local service setup path
4. CI wiring that runs the same suite automatically

Service-backed dialects should use Docker as the standard maintainer path for local integration execution. SQLite can run directly against an in-memory or file-backed database, while most other dialects will depend on an external service.

Add a service to `docker-compose.integration.yml`, then document and test the command flow maintainers are expected to use:

```bash
docker compose -f docker-compose.integration.yml up -d <service-name>
pnpm test:integration:<dialect>
docker compose -f docker-compose.integration.yml down -v
```

PostgreSQL is the current reference pattern:

```bash
docker compose -f docker-compose.integration.yml up -d postgres
pnpm test:integration:postgres
docker compose -f docker-compose.integration.yml down -v
```

If the dialect is intended to be first-party, update `scripts/test-integration-all.sh` and CI so the same Docker-backed suite is exercised automatically.

## 7. Update testing helpers that branch on dialect behavior

The harness is one part of the testing workflow. Tango also has helper code that normalizes backend-specific behavior during integration testing.

Review these helpers carefully, because they often contain the last dialect-specific assumptions that make a new backend feel incomplete during testing:

- `packages/testing/src/integration/config.ts`
- `packages/testing/src/integration/migrations/IntrospectSchema.ts`
- `packages/testing/src/integration/orm/seedTable.ts`

For example, `resolveAdapterConfig(...)` in `packages/testing/src/integration/config.ts` decides how harness configuration is derived from explicit options, Tango config, and environment variables. `introspectSchema(...)` currently resolves the built-in dialect introspectors directly. A new dialect often needs both of those branches revisited before the test harness behaves like a first-party backend.

If a helper cannot be generalized immediately, make the limitation explicit in tests and contributor docs so future maintainers can see the boundary clearly during implementation and review.

## 8. Update CLI and maintainer tooling paths

Maintainers should be able to exercise the new dialect through the same operational surfaces they already use for migrations and integration work.

The migration CLI is one of the most important touchpoints here. Review `packages/migrations/src/commands/cli.ts` and make sure the dialect can be resolved from config, connected through the CLI's direct database client path, and used by the migration generator and runner without backend-specific breakage.

If the dialect is meant to be selectable through Tango config, also confirm that `loadConfig(...)` and the typed config schema accept the new adapter name cleanly. Experimental support may begin with explicit local wiring, while a standard maintainer path should wait until config and CLI behavior are aligned.

## 9. Update scaffolding and examples when support is first-class

This step is required for first-class support and optional for internal conformance support.

When Tango is ready to present the dialect as a normal application choice, update the scaffolding contracts and example projects so maintainers and users can begin from a supported baseline with standard generated files and instructions.

The first-class support path usually touches:

- `packages/codegen/src/frameworks/contracts/FrameworkScaffoldStrategy.ts`
- CLI command surfaces that enumerate scaffold dialects, such as `packages/codegen/src/commands/runNewCommand.ts`
- generated `tango.config.ts` templates
- example project dependencies, bootstrap steps, and environment notes

If you are not ready to support the dialect publicly, leave these surfaces unchanged and document the limitation clearly.

## 10. Add tests and run the validation matrix

Once the dialect is wired through the relevant contracts, prove the onboarding through tests at each layer that now owns dialect-specific behavior.

The usual validation matrix includes:

1. ORM adapter and client tests
2. migrations compiler and introspector tests
3. harness lifecycle tests
4. the dialect-specific integration suite
5. `runDialectConformanceSuite(...)` for the new strategy
6. config or CLI tests when dialect selection changed
7. CI execution for the backend service

Run narrower package-filtered tests while you are iterating, then run the broader integration path before opening the pull request.

## 11. Update documentation in the same pull request

Dialect onboarding changes what Tango supports and how maintainers reason about backend behavior, so the documentation should move with the code.

Review and update the documentation surfaces that define the support boundary:

- this how-to when the maintainer workflow changes
- [Dialects in Tango](/contributors/topics/dialects) when architectural boundaries or support language changes
- user-facing database documentation when support becomes first-class
- relevant package READMEs when package-level setup or capabilities change

If the onboarding changes a package README for a published package, remember that a README-only change still needs a changeset so the updated README reaches npm.

## Final review before you open the pull request

Before you call the onboarding complete, read through this checklist once more:

1. The dialect name is represented consistently across Tango's typed contract surfaces.
2. The ORM can resolve the dialect through its adapter registry and produce a working `DBClient`.
3. Migrations can both compile operations and introspect live schema for the dialect.
4. The testing layer exposes a reliable `HarnessStrategy` and `IntegrationHarness` for the backend.
5. A dialect-specific integration suite exists and uses Docker for service-backed databases.
6. Dialect-sensitive helper branches in testing, config, and CLI code have been updated where necessary.
7. Scaffolding and examples match the intended support level.
8. CI and local maintainer workflows can reproduce the backend environment predictably.
9. Contributor and user documentation reflect the actual support boundary.

## Related pages

- [Contributor how-to guides](/contributors/how-to/)
- [Contributor topics](/contributors/topics/)
- [Dialects in Tango](/contributors/topics/dialects)
