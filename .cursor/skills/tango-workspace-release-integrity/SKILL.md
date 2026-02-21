---
name: tango-workspace-release-integrity
description: Enforce Tango workspace and release integrity for package metadata and automation changes. Use when touching package.json exports, build configs, scripts, CI workflows, or release tooling, so install, build, and publish behavior stays deterministic.
---

# Tango Workspace Release Integrity

Execute this workflow for build, package, workspace, and CI/CD changes.

## Workflow

1. Announce `Executing tango-workspace-release-integrity`.

### Phase 1: Exports and Build Alignment

1. Do: Inspect package contracts and build entrypoints for touched packages.
2. Check against rules:
    - Ensure `package.json` exports map to real build outputs.
    - Ensure build config entrypoints cover every exported subpath.
    - Ensure runtime import paths are ESM-safe and consistent.
3. Address issues:
    - Add or remove exports to match real dist files.
    - Add or remove build entries to match public exports.
    - Fix import paths that depend on invalid directory or legacy resolution behavior.

### Phase 2: Workspace Script Integrity

1. Do: Review root and package scripts for recursive workspace correctness.
2. Check against rules:
    - Ensure scripts execute against intended workspace scope.
    - Ensure typecheck and test scripts enforce the same gates locally and in CI.
    - Ensure generated scaffolds and examples contain runnable scripts for declared workflows.
3. Address issues:
    - Correct recursive script usage and workspace filters.
    - Remove script drift between docs, scaffolds, and actual package behavior.
    - Add missing scripts required for deterministic setup, migrate, bootstrap, and cleanup flows.

### Phase 3: CI and Release Parity

1. Do: Compare CI workflow behavior against local workflow expectations.
2. Check against rules:
    - Ensure CI executes the same key validation gates as local workflows.
    - Ensure release automation respects package dependency and publish ordering constraints.
    - Ensure canary and stable release paths are explicit and deterministic.
3. Address issues:
    - Update CI workflow commands to mirror local canonical scripts.
    - Fix missing environment wiring, matrix coverage, or release step gaps.
    - Align release workflows with trusted publishing and package export realities.

### Phase 4: End-to-End Packaging Validation

1. Do: Execute final packaging checks on affected packages.
2. Check against rules:
    - Ensure each package builds, typechecks, and tests successfully.
    - Ensure generated artifacts are runnable by consumers without workspace-only assumptions.
    - Ensure dependency declarations accurately reflect runtime requirements.
3. Address issues:
    - Fix dependency, entrypoint, or artifact gaps.
    - Re-run package-level and workspace-level validation commands.
    - Report final status with explicit pass/fail command outcomes.

## Validation Commands

- `pnpm --filter <package> build`
- `pnpm --filter <package> typecheck`
- `pnpm --filter <package> test`
- `pnpm -r build`
- `pnpm typecheck`
- `pnpm -r test`
