# Releasing packages

Releasing Tango publishes the fixed-version package set through the repository's trusted publishing workflow.

We recommend completing the [Contributor setup](/contributors/setup) before you begin. Releases must also be performed by maintainers that have need permission to run the repository's GitHub Actions workflows and access to the `npm` environment that backs trusted publishing.

A typical release moves through the following stages:

- validating the branch you intend to release
- confirming whether the release is stable or alpha
- making sure changesets are present for stable release work
- letting the release workflow run versioning, tests, and publishing
- verifying the published result
- updating the release contract files when the release system itself changes

## Understand the release channels

Tango ships through two release channels.

Stable releases publish the normal package versions that advance the fixed Tango release train. They are driven by changesets, update the root changelog, and must publish from `main`.

Alpha releases publish snapshot builds under the `alpha` dist-tag. They support testing and early feedback, and they leave the root changelog unchanged.

## Validate the branch before you release

The release workflow runs database-backed integration checks before publishing, but maintainers should still validate the branch locally before merging releasable work or dispatching a manual run. That keeps release debugging separate from normal branch validation.

Run the same quality gates expected by the repository:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:integration:all
```

If one of those commands fails, it _will_ block your release, so you must resolve it before you publish.

## Prepare a stable release

Stable releases are changeset-driven. Each pull request that changes releasable package behavior should include a changeset so the release workflow knows which version bump to apply and which release notes to generate.

Create a changeset during development with:

```bash
pnpm changeset
```

Once the releasable pull requests are merged to `main`, the stable release path is ready. In normal operation, a push to `main` triggers the stable workflow automatically. If you need to rerun the stable path manually, dispatch the workflow with `release_type=stable` and `branch=main`.

## What the stable workflow does

The stable release workflow versions packages, tests the release candidate, commits generated version changes, and publishes the resulting packages.

The workflow performs these steps:

1. checks out `main`
2. installs dependencies and waits for PostgreSQL
3. runs the SQLite and PostgreSQL integration suites
4. runs `pnpm changeset:version`
5. checks whether versioning produced a diff
6. commits generated version changes to `main` with a bot-authored `[skip ci]` commit when a release is pending
7. publishes the packages through trusted publishing

The stable versioning command is `pnpm changeset:version`, which runs `scripts/release/version-with-root-changelog.ts`. That script executes `changeset version`, refreshes the lockfile, and prepends the new entry to the root `CHANGELOG.md`.

If `pnpm changeset:version` produces no diff, the stable workflow becomes a no-op for publishing. That usually means there were no pending releasable changesets on `main`.

## Run an alpha release

Alpha releases are manual. Dispatch the release workflow with `release_type=alpha` and choose the branch you want to publish from.

The alpha path performs these steps:

1. checks out the selected branch
2. installs dependencies and runs the integration suites
3. generates a short commit SHA
4. versions packages with `changeset version --snapshot alpha-<short-sha>`
5. builds the packages
6. publishes them with the `alpha` dist-tag

Alpha releases preserve the existing root changelog. The workflow publishes the snapshot build directly from the selected branch, and `main` remains unchanged.

## Verify the published result

After a release completes, confirm that the published packages match the intended channel and version shape.

For stable releases, the published Tango packages should share one version because the workspace is configured as a fixed release group. Internal `workspace:*` dependencies are rewritten to concrete published versions during release, so the generated version commit should show a consistent version across the releasable workspace packages.

For alpha releases, confirm that the published versions carry the snapshot suffix and use the `alpha` dist-tag.

## Updating the release system

Release mechanics change less often than package code, but when that contract changes, update the release documentation and the release-defining files together.

When the release system changes, update these files and settings in the same pull request:

- `.github/workflows/release.yml`
- `.changeset/config.json`
- `scripts/release/version-with-root-changelog.ts`
- root `package.json` scripts for `changeset:version` and `changeset:publish`
- repository Actions configuration for `RELEASE_APP_ID` and `RELEASE_APP_PRIVATE_KEY`
- this page

Those files govern branch eligibility, release channel behavior, version generation, changelog generation, and publish authentication. Keep them aligned in the same pull request whenever the release process changes.

## Where to go next

These contributor pages are often useful alongside release work:

- [Contributor setup](/contributors/setup)
- [Contributing code](/contributors/contributing-code)
- [Contributor topics](/contributors/topics/)
- [Contributor how-to guides](/contributors/how-to/)
