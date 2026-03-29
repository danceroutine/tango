---
name: tango-runtime-and-testing-standards
description: Enforce Tango runtime behavior and testing standards for feature work. Use when modifying adapters, resources, ORM, migrations, examples, or integration behavior, so runtime ergonomics remain batteries-included and tests remain deterministic and complete.
---

# Tango Runtime and Testing Standards

Execute this workflow for behavior changes and integration-sensitive refactors.

## Workflow

1. Announce `Executing tango-runtime-and-testing-standards`.

### Phase 0: Fixture Reuse Inventory

1. Do: Inventory test helpers in affected files before writing new fixtures.
2. Check against rules:
    - First attempt to reuse fixtures from `@danceroutine/tango-testing` (`mocks`, `integration`, `vitest`).
    - Do not add local `make*/create*/build*` fixtures when an equivalent shared fixture exists.
    - If a local fixture pattern is repeated more than once across tests, it must be promoted into `@danceroutine/tango-testing`.
3. Address issues:
    - Replace duplicated local fixtures with shared fixtures.
    - Add new shared fixtures to `@danceroutine/tango-testing` with exports and symbol-scoped tests.
    - Update all affected test files to consume the new shared fixture.

### Phase 1: Runtime Ergonomics Integrity

1. Do: Identify the runtime flows affected by the change.
2. Check against rules:
    - Prefer one-call setup patterns for common flows.
    - Avoid forcing manual route or behavior glue for expected framework use cases.
    - Keep API-layer behavior consistent across Express and Next adapter surfaces when parity is expected.
3. Address issues:
    - Add or update framework-facing helpers for common behavior.
    - Remove unnecessary manual wiring from examples when framework utilities can own it.
    - Align cross-adapter behavior where the contract should match.

### Phase 2: Migrations-First Data Integrity

1. Do: Inspect schema setup paths for examples, tests, and integration workflows.
2. Check against rules:
    - Create schema through Tango migrations and ORM workflows.
    - Avoid ad hoc schema bootstrap SQL as primary setup path.
    - Keep setup and teardown idempotent for repeated local and CI runs.
3. Address issues:
    - Replace ad hoc setup code with migration-driven setup.
    - Add pre and post scripts for deterministic cleanup where needed.
    - Ensure generated migrations, apply flow, and reset flow all work end-to-end.

### Phase 3: Integration and Coverage Integrity

1. Do: Run package and integration tests for all affected runtime paths.
2. Check against rules:
    - Cover both SQLite and Postgres integration surfaces where applicable.
    - Keep tests deterministic with clean environment setup and teardown.
    - describe blocks should pass class or function references, or `.prototype.method` references
    - test titles should not leak implementation details and should be written from a blackbox business logic description perspective.
    - test titles should be written to be grammatically correct, and should follow the pattern of using the `it` function call as the start of the sentence. `"It <does something>"` -> `it('<does something>')`
    - Keep test files in `tests/` directories that are siblings of the runtime files they validate.
    - Keep test files symbol-scoped: one test file per top-level class or top-level function.
    - Name test files after the symbol under test for direct IDE discoverability.
    - Avoid centralized or cross-domain test placement when sibling `tests/` placement is feasible.
    - Avoid cross-package source imports in tests (`../other-package/src/...`); use package entrypoints/subpaths.
    - Shared fixtures must maintain full type adherence to the real contracts they mock.
    - Reach coverage gates without blanket exclusions.
3. Address issues:
    - Add missing unit, integration, or smoke tests.
    - Relocate tests to sibling `tests/` folders and fix imports when layout violates this rule.
    - Split combined test files that validate multiple top-level symbols into separate symbol-specific files.
    - Fix setup isolation problems that block repeated runs.
    - If shared fixture updates cause type mismatch in consumers, fix the fixture implementation rather than casting at call sites.
    - Use targeted coverage only for truly unreachable branches, and document each exemption if used.

### Phase 4: Regression Safety and Reporting

1. Do: Perform final regression validation for changed runtime packages.
2. Check against rules:
    - Ensure behavior changes are intentional and verified.
    - Ensure old supported workflows still pass unless explicitly replaced.
    - Ensure examples remain runnable and representative of official contracts.
    - Validate fixture producers and fixture consumers in the same pass.
3. Address issues:
    - Fix regressions and rerun validations until clean.
    - Update example app wiring to match current package contracts.
    - Report command results, fixed regressions, and any remaining known risks.
    - Report which local fixtures were removed, which shared fixtures were added, and where they are now reused.

## Validation Commands

- `pnpm --filter <package> test`
- `pnpm --filter <package> typecheck`
- `pnpm --filter @danceroutine/tango-testing test`
- `pnpm --filter @danceroutine/tango-testing typecheck`
- `pnpm test:integration` (or equivalent dialect integration command)
- `pnpm test` at workspace level when cross-package runtime behavior changed
