---
name: tango-core-engineering-standards
description: Enforce Tango core engineering standards for source-code changes. Use when implementing or reviewing code that touches package structure, exports, typing, branding, or refactors, so changes remain domain-driven, discoverable, strictly typed, and free of compatibility shims.
---

# Tango Core Engineering Standards

Execute this workflow for any Tango code change that affects package source files.

## Workflow

1. Announce `Executing tango-core-engineering-standards`.

### Phase 1: Domain Structure Integrity

1. Do: Inspect changed files and classify each file as `domain boundary`, `implementation`, `test`, or `package contract`.
2. Check against rules:
    - Keep `index.ts` files contract-only, and keep implementation logic out of barrels.
    - Place implementations in symbol-discoverable files where file names match primary symbols.
    - Group related symbols inside meaningful subdomains, and avoid catch-all dumping folders.
    - Place tests in a `tests/` directory that is a sibling of the implementation file being tested.
    - Keep test files symbol-scoped: one test file per top-level class or top-level function.
    - Name test files after the primary symbol under test (for example `Foo.test.ts` for `Foo.ts`).
    - Do not place tests in unrelated shared folders when a local sibling `tests/` folder is possible.
    - For test fixtures, prefer existing `@danceroutine/tango-testing` helpers before creating local helpers.
    - Do not import another package internals via `../<pkg>/src/...` paths in tests; use package entrypoints/subpaths only.
3. Address issues:
    - Move implementation bodies out of `index.ts`.
    - Split mixed files into subdomain folders when cohesion is low.
    - Rename files for symbol discoverability where needed.
    - Move test files to sibling `tests/` folders and update imports/paths accordingly.
    - Split multi-symbol test files so each top-level class or function has its own dedicated test file.
    - Replace local test helpers with `tango-testing` fixtures when a suitable fixture already exists.
    - If the same local fixture pattern appears more than once, promote it into `@danceroutine/tango-testing` and reuse it.

### Phase 2: Public API and Export Integrity

1. Do: Read package root `src/index.ts`, subdomain `index.ts`, `package.json` exports, and build entries.
2. Check against rules:
    - Expose both curated flat exports and namespaced subdomain exports.
    - Keep package-root and domain-barrel JSDoc that explains why Tango uses dual exports and domain barrels.
    - Keep root exports intentional, and avoid accidental transitive API growth.
    - Ensure every exported subpath resolves to a real built entrypoint.
3. Address issues:
    - Add or update barrel JSDoc blocks when they are missing, stale, or inconsistent with current export strategy.
    - Add or remove exports to match intended public API.
    - Update subpath exports and build entries in lockstep.
    - Remove stale deep import paths from internal usage.

### Phase 3: Type and Identity Integrity

1. Do: Run a type-rigor scan over touched files.
2. Check against rules:
    - Remove explicit `any` from source and tests.
    - Prefer `unknown`, constrained generics, and discriminated unions.
    - Use brand-based static typeguards for Tango class identity checks.
    - Avoid fragile prototype identity assumptions for cross-module boundaries.
    - Ensure test fixtures adhere to real runtime contracts rather than ad hoc structural approximations.
3. Address issues:
    - Replace `any` and unsafe casts with typed alternatives.
    - Add missing class brands and `isX` static guards.
    - Convert identity checks to brand/typeguard-based checks when needed.
    - Rework fixture implementations so shared mocks satisfy the actual package interfaces/classes.

### Phase 5: Refactor Safety and Validation

1. Do: Validate changes with package-level and workspace-level checks.
2. Check against rules:
    - Avoid compatibility shims unless explicitly requested.
    - Keep behavior stable unless behavior change was explicitly requested.
    - Ensure no regressions in typecheck and relevant tests.
    - When shared test fixtures change, validate both producer (`@danceroutine/tango-testing`) and all touched consumer packages.
3. Address issues:
    - Update call sites directly instead of adding transitional aliases.
    - Fix regressions and rerun validation until green.
    - Report what changed, why it changed, and which validations passed.
    - For broad test refactors, maintain a per-file checklist and close each item explicitly.

### Phase 6: Documentation Integrity for Public Contracts

1. Do: Review touched public interfaces and behavior-level changes after runtime/type validation is green.
2. Check against rules:
    - Update JSDoc for all publicly exposed classes, methods, functions, interfaces, and types that changed.
    - Update developer-facing documentation when critical functionality is added, removed, renamed, or behaviorally changed.
    - Keep docs focused on stable contracts and durable guidance, not transient implementation details.
    - During this phase, execute the Tango technical writing skill at [.cursor/skills/tango-technical-writing/SKILL.md](/Users/pedro/coding/tango/.cursor/skills/tango-technical-writing/SKILL.md).
3. Address issues:
    - Add or revise public API docstrings in the same change that modifies the interface.
    - Update package-level and contributor documentation entries impacted by the change.
    - Ensure examples and usage snippets reflect the current API and behavior.

## Validation Commands

- `pnpm --filter <package> typecheck`
- `pnpm --filter <package> test`
- `pnpm --filter <package> build`
- `pnpm typecheck` for cross-package verification when exports or shared types changed
