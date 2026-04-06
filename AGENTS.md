# Tango Skills Orchestration

Use the following project skills as mandatory execution workflows based on task type.

## 1) Core Engineering Skill (default for code changes)

When implementing or refactoring source code in any Tango package, read and apply:

- `.cursor/skills/tango-core-engineering-standards/SKILL.md`

Apply this skill for:

- package source changes
- domain structure and export-surface work
- typing, branding, and typeguard correctness

## 2) Runtime and Testing Skill (behavior changes)

When changing runtime behavior, integrations, examples, or test strategy, read and apply:

- `.cursor/skills/tango-runtime-and-testing-standards/SKILL.md`

Apply this skill for:

- adapters, resources, orm, migrations behavior changes
- integration test setup/teardown work
- migration-driven schema setup and runtime correctness validation

## 3) Workspace and Release Integrity Skill (tooling/package metadata)

When changing package metadata, build config, scripts, or CI/release automation, read and apply:

- `.cursor/skills/tango-workspace-release-integrity/SKILL.md`

Apply this skill for:

- `package.json` exports/dependencies/scripts
- build entrypoint alignment (`tsdown`, tsconfig, dist contract)
- CI/CD and release pipeline changes

## 4) Release Operations Skill (running releases)

When preparing, triggering, or verifying stable/alpha releases, read and apply:

- `.cursor/skills/tango-release-workflow/SKILL.md`

Apply this skill for:

- stable release execution (changesets/action version PR and publish path)
- alpha snapshot release execution (`workflow_dispatch` with `release_type=alpha`)
- release checkpoints that require maintainer guidance before irreversible actions

## 5) Documentation Skill (technical prose only)

When working on documentation, package READMEs, or public-facing docstrings and JSDoc, read and apply:

- `.cursor/skills/tango-technical-writing/SKILL.md`

This skill is the canonical Tango writing standard for:

- `docs/**/*.md`
- package `README.md`
- public-facing docstrings and JSDoc

Use the writing skill for technical prose work only, and do not apply it to unrelated code-only changes.

## 6) Adversarial Review Skill

When asked to perform an adversarial review, read and apply:

- `.cursor/skills/adversarial-review/SKILL.md`

## Skill Stacking Rule

When a task spans multiple categories, apply all matching skills in this order:

1. `tango-core-engineering-standards`
2. `tango-runtime-and-testing-standards`
3. `tango-workspace-release-integrity`
4. `tango-release-workflow`
5. `tango-technical-writing`
