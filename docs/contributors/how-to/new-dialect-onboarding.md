# Onboard a new database dialect

A dialect onboarding in Tango is a cross-package change that spans runtime adapters, migration compilation and introspection, integration harness behavior, and configuration or CLI surfaces that select a dialect at runtime. The onboarding is complete only when those contracts agree with each other and remain testable through one repeatable maintainer workflow.

Read [Dialects in Tango](/contributors/topics/dialects) first for architecture and contract boundaries, then use this workflow to execute the implementation in maintainable order.

## Choose your support target

Dialect onboarding usually lands in one of two support levels:

1. Internal conformance support, where maintainers run dialect-specific integration and migration checks through explicit wiring and controlled CI coverage. Public scaffolding and default application configuration remain out of scope at this stage.
2. First-class public support, where the dialect is available through application-facing config, CLI workflows, examples, and scaffolding defaults.

## Completion criteria

Treat a dialect onboarding as complete only when all of these are true:

1. ORM can create and use a dialect-specific `DBClient` through an `Adapter`.
2. Migrations can compile operations and introspect live schema for the dialect.
3. Testing exposes a working `IntegrationHarness` strategy with correct capability flags.
4. `TestHarness.forDialect(...)` resolves the dialect and `runDialectConformanceSuite(...)` passes.
5. Config and CLI surfaces resolve the dialect consistently for maintainer workflows.
6. CI can run the dialect reproducibly with documented environment setup.
7. Contributor and user docs reflect the actual support level and boundaries.

## 1. Extend dialect identifiers and typed surfaces

Add the dialect identifier where Tango currently maintains explicit dialect unions. Treat these as contract surfaces that should be updated deliberately and reviewed together.

Common update points include:

- `packages/testing/src/integration/domain/Dialect.ts`
- `packages/migrations/src/domain/internal/InternalDialect.ts`
- `packages/orm/src/query/domain/internal/InternalDialect.ts`
- `packages/config/src/schema/AdapterName.ts`

If a surface currently uses hardcoded unions such as `'postgres' | 'sqlite'`, update that union or route it through a shared dialect contract before you continue. This prevents partially onboarded dialect support that compiles in one package but fails in another.

## 2. Implement the ORM runtime contract

A dialect onboarding must provide an ORM-level execution path that yields a valid `DBClient`.

Implement and wire:

1. a dialect `Adapter` implementation in the ORM connection layer
2. a dialect `DBClient` implementation, or adapter logic that returns a compatible `DBClient`
3. default adapter registration so runtime code can resolve the adapter by name

The adapter should declare supported feature flags, because migration and query behavior may rely on those capabilities when choosing safe SQL behavior.

## 3. Implement migrations contracts

Migrations support requires both compilation and introspection support for the dialect.

Implement:

1. a migrations SQL compiler and compiler factory for the dialect
2. a schema introspector for the dialect
3. registration in default compiler and introspector strategies

## 4. Implement the integration testing contract

Create a harness strategy in `packages/testing/src/integration/strategies/` that implements `HarnessStrategy` and returns an `IntegrationHarness`.

The resulting harness must guarantee:

- `setup()` leaves the dialect ready for migrations and repository operations
- `reset()` returns state to a repeatable baseline
- `teardown()` releases resources safely, including failure paths
- `migrationRunner(...)` works after setup and fails deterministically before setup

Set `DialectTestCapabilities` to match real backend behavior:

- `transactionalDDL`
- `supportsSchemas`
- `supportsConcurrentIndex`
- `supportsDeferredFkValidation`
- `supportsJsonb`

Register the strategy in `TestHarness` when the dialect should be part of default first-party strategy resolution.

## 5. Update testing helpers that branch on dialect

Several testing helpers contain dialect-specific logic for behavior normalization or introspection routing. Review and update those branches so helper behavior stays correct for the new dialect.

Typical touchpoints include:

- `packages/testing/src/integration/migrations/IntrospectSchema.ts`
- `packages/testing/src/integration/orm/seedTable.ts`
- `packages/testing/src/integration/config.ts`

If helper behavior cannot be made generic yet, document the limitation explicitly in contributor docs and tests so the boundary remains visible.

## 6. Update config and CLI resolution paths

If the dialect should work in standard maintainer workflows, update config and CLI surfaces that currently enumerate supported dialect choices.

Typical surfaces include:

- adapter validation in `@danceroutine/tango-config`
- env override typing in `loadConfig(...)`
- migration CLI dialect choices and connection setup in `@danceroutine/tango-migrations` commands

Long-term maintainer workflows are strongest when the dialect can be selected through standard config and CLI paths, with direct programmatic wiring reserved for specialized cases.

## 7. Update scaffolding and examples for first-class support

When your target is first-class public support, extend scaffolding and examples so users can start with the dialect without manual repository surgery.

Typical surfaces include:

- dialect enums and template branching in `@danceroutine/tango-codegen`
- generated `tango.config.ts` defaults
- example project dependency sets and bootstrap instructions

## 8. Add tests and run the validation matrix

Add targeted tests in each package that now owns dialect-specific behavior, then run a matrix that proves contracts agree across layers.

Recommended validation includes:

1. ORM adapter and query behavior tests for the dialect
2. migrations compiler and introspector tests for the dialect
3. harness lifecycle tests and `runDialectConformanceSuite(...)`
4. CLI or config resolution tests when dialect choice logic changed
5. integration execution in CI for the new dialect backend

When running locally, prefer package-filtered loops first and then run the broader integration matrix before opening the pull request.

### Containerized conformance pattern

The PostgreSQL setup in this repository is the reference implementation for dialect conformance environments that depend on external services. The maintainer workflow uses Docker to provision the backend, execute dialect-focused integration tests, and then tear the environment down. You can extend this same pattern to other dialects by adding a service definition, dialect-specific environment values, and a matching integration test command.

```bash
docker compose -f docker-compose.integration.yml up -d postgres
pnpm test:integration:postgres
docker compose -f docker-compose.integration.yml down -v
```

The PostgreSQL command path above aligns with the current repository defaults, including `postgres://postgres:postgres@localhost:5432/tango_test`, and serves as the baseline pattern for future dialect-specific conformance pipelines.

## 9. Update documentation in the same pull request

Update contributor docs and user docs in the same change so support boundaries are visible immediately.

At minimum, update:

- this how-to if workflow changed
- [Dialects in Tango](/contributors/topics/dialects) when architectural boundaries changed
- user-facing database docs if support is first-class
- relevant package READMEs when onboarding affects package-level setup or capabilities

## Final checklist

1. Dialect identifiers and typed unions are updated consistently across packages.
2. ORM adapter and `DBClient` behavior are implemented and tested.
3. Migrations compiler and introspector support are implemented and registered.
4. Harness strategy lifecycle behavior is deterministic and conformance checks pass.
5. Dialect-aware helper branches in testing are updated or explicitly constrained.
6. Config and CLI resolution paths support the dialect at the intended support level.
7. Scaffolding and examples are updated when first-class support is intended.
8. CI runs the dialect reproducibly and contributors can reproduce failures locally.
9. Contributor and user documentation reflects the actual support boundary.

## Related pages

- [Contributor how-to guides](/contributors/how-to/)
- [Contributor topics](/contributors/topics/)
- [Dialects in Tango](/contributors/topics/dialects)
