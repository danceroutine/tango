# Contributing code

Contributing to Tango is the best way to shape the framework's behavior and developer experience. The contribution path is straightforward once you have a working local checkout, and the sections below walk through the normal workflow from choosing a change to opening a pull request.

Complete [Contributor setup](/contributors/setup) before you begin, since the workflow below assumes a local checkout that can already build and run the workspace.

Documentation-only contributions follow a different workflow and are covered in [Writing documentation](/contributors/writing-documentation).

A typical code contribution moves through the following stages:

- choosing a change that is ready to implement
- creating a focused branch
- writing or updating tests
- making code changes in the right layer
- updating documentation and public contracts
- running the validation gates expected before review
- opening a pull request

## Choose a change to work on

Small bug fixes, missing tests, and focused ergonomics improvements are good places to start. Larger changes benefit from early maintainer alignment, especially when they introduce new public behavior, expand a package surface, or change contributor workflows. In those cases, open or join a GitHub discussion before writing code so the scope and direction are clear.

Repository-specific context becomes much easier to navigate once you know the area you want to work in. These contributor sections are the best next stop:

- [Contributor topics](/contributors/topics/)
- [Contributor how-to guides](/contributors/how-to/)

## Create a branch

Create a feature branch before you begin editing code so the work stays isolated from your local main branch:

```bash
git checkout -b feat/short-description
```

Semantic branch names in the style `(feat|fix|chore)/kebab-case-description-of-goal` work well because they make the intent of the branch easy to recognize during review.

## Run Tango's validation suite once before you edit code

A clean run on an untouched checkout gives you a useful baseline. If a command fails before you change anything, you can debug the local environment without mixing that problem together with your own edits.

SQLite-backed validation generally runs without additional service setup. Changes in migrations, adapters, SQL generation, dialect behavior, or other database-backed integration paths should also be validated against PostgreSQL and the full integration matrix. Docker is part of the expected local toolchain for those checks.

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:integration:all
```

While iterating on a dialect-sensitive change, narrower integration runs are often enough to get quick feedback:

```bash
pnpm test:integration:sqlite
pnpm test:integration:postgres
```

## Write or update tests first when possible

Almost all accepted code contributions require tests. A bug fix needs a regression test that fails before the fix and passes after it. A new feature needs tests that demonstrate the new contract from the perspective of the caller. Tango enforces this with a 100% code coverage policy that requires maintainer approval for exemptions.

Tango has several testing layers, and the right one depends on what changed:

- unit tests for isolated behavior inside a package
- integration tests for ORM, migration, adapter, or dialect behavior
- example-project tests when the change affects documented usage or end-to-end behavior

Start with the smallest test that can prove the contract you are changing, then move outward when the behavior crosses package boundaries. Changes that depend on database capabilities should be validated against the relevant dialect suites before review.

## Make the code change

As you implement the change, keep Tango's engineering standards in view:

1. Prefer explicit contracts over implicit behavior.
2. Keep `index.ts` files focused on contract management and export-surface organization.
3. Place tightly coupled types near the primary symbol they describe.
4. Preserve the dual export style of curated root imports and namespaced subdomain imports.
5. Keep package dependency boundaries and `exports` maps deliberate.
6. Avoid explicit `any` in source and tests. If an explicit `any` is necessary, contain it's use, apply safeguards and cast to a known type to avoid propogating the `any` typing to the rest of the codebase.
7. Maintain the existing typecheck and coverage expectations.

Not every contribution touches every concern, but most review feedback lands in one of those categories. Code that makes its contracts obvious to readers and consumers usually fits Tango well.

## Update documentation and public contracts

Tango treats documentation as part of the public contract. Public behavior changes, public API changes, documented workflow changes, and example changes should be reflected in prose within the same pull request.

Depending on the scope, the pull request may need updates in one or more of the following places:

- user documentation under `docs/guide`, `docs/topics`, `docs/how-to`, or `docs/reference`
- contributor documentation when maintainer workflows or maintainer-facing contracts change
- the relevant package `README.md`
- example projects when they demonstrate the feature you changed

If your work adds a new database dialect to Tango's integration testing support, continue with [Onboard a new database dialect](/contributors/how-to/new-dialect-onboarding).

## Review the diff before you commit

Once the tests you are using locally are passing, stage the intended changes and inspect the diff before committing:

```bash
git add --all
git diff --cached
```

Reviewing the staged diff regularly catches stray formatting noise, debug code, or missing documentation before anyone else has to point them out.

## Run the pull request gates

Before opening a pull request, run the full validation suite expected by the repository:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:integration:all
```

Run those local gates before review so maintainers can start from a branch that already satisfies the repository's baseline checks.

## Commit and open the pull request

Write a commit message that makes the intent of the change easy to understand. Then push your branch and open a pull request against the repository.

The commit message should follow [conventional commit](https://www.conventionalcommits.org/en/v1.0.0/) format.

The pull request description should give reviewers enough context to evaluate the change without reconstructing the entire story from the diff. Include the problem you addressed, the approach you took, and the validation you ran. If the change affects public behavior, call out the documentation updates that shipped with it.

## Where to go next

These contributor pages are often useful alongside code changes:

- [Contributor setup](/contributors/setup)
- [Contributor topics](/contributors/topics/)
- [Contributor how-to guides](/contributors/how-to/)
- [Writing documentation](/contributors/writing-documentation)
- [Releasing packages](/contributors/releasing)
