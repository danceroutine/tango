# Contributing

Engineering standards for contributions to Tango live here. For environment setup and release workflow, use the [Contributor documentation](/contributors/) alongside this guide.

## Engineering guidelines

Contributors should keep these standards in mind while working in the repository:

1. prefer explicit contracts over implicit behavior
2. keep `index.ts` files focused on contract management rather than implementation bodies
3. place tightly coupled types near the primary symbol they describe
4. preserve the dual export style of curated root imports and namespaced subdomain imports
5. keep package dependency boundaries and `exports` maps deliberate
6. avoid explicit `any` in source and tests
7. maintain the existing typecheck and coverage expectations

## Pull request gates

Before opening a pull request, run:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:integration:all
```

Those commands are part of the expected contribution workflow, not an optional polishing step.

## Documentation policy

Any change to public behavior or public API should update documentation in the same pull request. Depending on the scope of the change, that usually includes:

- user-facing docs under `guide`, `topics`, `how-to`, or `reference`
- contributor docs when workflow or maintainer contracts change
- the relevant package README

## Documentation and contract updates

Tango treats docs as part of the public contract. If behavior changes, update docs in the same pull request:

- user docs in `docs/guide`, `docs/topics`, `docs/how-to`, or `docs/reference`
- contributor docs when maintainer workflow changes
- the relevant package README

If your work adds a new database dialect to the integration harness, follow [Onboard a new database dialect](/contributors/how-to/new-dialect-onboarding).

If you create a feature branch, we recommend semantic branch names in the style `(feat|fix|chore)/kebab-case-description-of-goal`.

## Validate database integration paths

Most feature work can begin with SQLite-backed tests for speed, but changes in migrations, adapters, SQL behavior, or dialect-specific features must be validated against the full dialect integration suite.

```bash
pnpm test:integration:sqlite
pnpm test:integration:postgres
pnpm test:integration:all
```
