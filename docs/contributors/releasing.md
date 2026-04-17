# Releasing packages

Tango publishes stable and alpha packages through the repository's trusted publishing workflow.

Complete the [Contributor setup](/contributors/setup) before you begin. Maintainers need permission to run the repository's GitHub Actions workflows and, when required, approve deployments into the protected `npm` environment. The repository owns the release app settings such as `RELEASE_APP_ID` and `RELEASE_APP_PRIVATE_KEY`; maintainers do not supply those values manually during a normal release.

## Release channels

Tango ships through two release channels.

Stable releases publish the normal package versions that advance the fixed Tango release train. They are driven by changesets, update the root changelog, and must publish from `main`.

Alpha releases publish snapshot builds under the `alpha` dist-tag. They support testing and early feedback, and they leave the root changelog unchanged.

## Release invariant

`main` is the source of truth for intended stable releases.

That leads to three normal release states:

- `repo == registry`: npm already matches the committed release state, so the workflow does nothing.
- `repo > registry`: the repository is ahead of npm, so the workflow publishes the missing versions.
- `registry > repo`: npm is ahead of the committed release state, so the workflow fails and requires maintainer intervention.

The workspace remains a fixed release group in git. Every stable release still advances the public Tango packages in lockstep. npm can drift out of lockstep temporarily if a publish fails partway through, so the release workflow and recovery path evaluate registry state per package before deciding what to do next.

## Validate the branch before you release

The release workflow runs the database-backed integration suites before publishing, but maintainers should still validate the branch locally before merging releasable work or dispatching a manual run. That keeps release debugging separate from ordinary branch validation.

Run the same quality gates expected by the repository:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:integration:all
```

A failing gate will block the release. Resolve it before you publish.

## Prepare a stable release

Stable releases are changeset-driven. Before you expect a stable publish to happen, make sure the merged pull requests on `main` already contain the changesets you intend to release.

In normal operation, a push to `main` triggers the stable workflow automatically. If you need to rerun the stable path manually, dispatch the workflow with `release_type=stable` and `branch=main`.

After a successful stable publish (including `stable-recovery`), the workflow also rebuilds and deploys the documentation site so the docs navigation version stays in sync with the latest release.

## Stable workflow behavior

The stable workflow validates the current release state before it mutates any versions.

The workflow performs these steps:

1. checks out `main`
2. installs dependencies and waits for PostgreSQL
3. runs the SQLite and PostgreSQL integration suites
4. compares the committed release state on `main` against npm
5. stops immediately if any existing published package no longer matches npm
6. runs `pnpm changeset:version`
7. checks whether versioning produced a diff
8. classifies each releasable package against npm again from the versioned release candidate state
9. commits generated version changes to `main` with a bot-authored `[skip ci]` commit when a release is pending
10. publishes the packages that are still missing from npm

The stable versioning command is `pnpm changeset:version`, which runs `scripts/release/version-with-root-changelog.ts`. That script executes `changeset version`, refreshes the lockfile, and prepends the new entry to the root `CHANGELOG.md`.

Each pending changeset summary is copied into the new release entry as authored Markdown rather than being rewritten into a synthetic bullet format. That means maintainers should write the changeset summary in the changelog shape they want to preserve, whether that is a concise paragraph, a short bullet list, or a compact illustrative code block for a major feature.

The release job pins Node 24 so trusted publishing can use the bundled npm 11 toolchain without a custom bootstrap layer in the workflow.

If `pnpm changeset:version` produces no diff, the stable workflow becomes a no-op for publishing. That usually means there were no pending releasable changesets on `main`.

## How Tango classifies stable publish state

You only need these labels when you are reading release logs or deciding whether `stable-recovery` is the right next move.

The release workflow checks each releasable package against npm and places it into one of four buckets:

- `already-published`: the committed package version already exists on npm
- `publish-missing`: the package exists on npm, but the committed version has not been published yet
- `unpublished-package`: the package has not been published to npm yet
- `registry-ahead`: npm already has a newer stable version than the committed repository state

The workflow makes those decisions from actual published versions, not only from the `latest` dist-tag. Stable publishing proceeds only when every package is either `already-published`, `publish-missing`, or `unpublished-package`. Any `registry-ahead` package fails the workflow because the repository is no longer the authoritative release state.

## Recover a failed stable publish

Stable releases commit the generated version changes before publishing. That keeps `main` as the source of truth for the release train, but it also means a publish outage can leave the repository ahead of npm.

When that happens, do not create a second changeset just to force another publish. Dispatch the workflow with:

- `release_type=stable-recovery`
- `branch=main`

The recovery path skips changeset versioning, inspects the committed package versions on `main`, classifies the npm state per package, and publishes only the versions that are still missing from the registry.

Wait a few minutes before rerunning recovery if the previous publish may have partially succeeded. A good rule is to wait until `npm view @danceroutine/tango-core version` and one or two other affected packages stop changing between checks. The recovery path relies on live registry reads, so it works best after npm metadata has settled.

## Operator decision guide

Use these rules when the stable workflow or stable recovery reports a mismatch.

### `repo == registry`

The committed stable state already matches npm. No recovery work is needed.

### `repo > registry`

The repository is ahead of npm. Use `stable-recovery` to publish the missing versions from `main`.

### `registry > repo`

npm is ahead of the committed repository state. Stop and investigate before you merge or dispatch anything else. Stable versioning must not continue until the mismatch is understood.

Check these first:

1. the most recent successful or partially successful `Release` workflow run on `main`
2. `npm view <package> version` for the packages reported as ahead
3. the package versions committed on `main`

If npm really is ahead, reconcile the repository with the published version before you dispatch another stable run.

### Partial publish

A partial publish means some packages from the fixed train reached npm and others did not. The repository stays lockstep, but npm no longer does. Use `stable-recovery` after registry state settles so the missing packages catch up to the committed repo version.

### Version commit succeeded, publish failed

The repository is now ahead of npm. Do not create another changeset. Run `stable-recovery` against `main`.

### Publish succeeded, commit failed

Treat this as a release emergency because npm is now ahead of the committed repository state. Do not dispatch another stable run until the repository is reconciled with the published version.

Start by identifying the workflow run that published successfully, confirming the published package version on npm, and then restoring `main` so it matches that versioned release state.

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

For stable releases, the public Tango packages should share one version because the workspace is configured as a fixed release group. Internal `workspace:*` dependencies are rewritten to concrete published versions during release, so the generated version commit should show a consistent version across the releasable workspace packages.

For alpha releases, confirm that the published versions carry the snapshot suffix and use the `alpha` dist-tag.

These commands are usually enough for a spot check:

```bash
npm view @danceroutine/tango-core version
npm view @danceroutine/tango-cli version
npm view @danceroutine/tango-core dist-tags --json
npm view @danceroutine/tango-cli dist-tags --json
```

For a stable release, the stable package versions should agree with the version committed on `main`. For an alpha release, the `alpha` dist-tag should point at the new snapshot version.

## Updating the release system

Release mechanics change less often than package code, but when that contract changes, update the release documentation and the release-defining files together.

When the release system changes, update these files and settings in the same pull request:

- `.github/workflows/release.yml`
- `.changeset/config.json`
- `scripts/release/resolve-publish-state.ts`
- `scripts/release/version-with-root-changelog.ts`
- root `package.json` scripts for `changeset:version` and `changeset:publish`
- repository Actions configuration for `RELEASE_APP_ID` and `RELEASE_APP_PRIVATE_KEY`
- this page

Those files govern branch eligibility, release channel behavior, version generation, changelog generation, registry-state reconciliation, and publish authentication. Keep them aligned in the same pull request whenever the release process changes.

## Where to go next

These contributor pages are often useful alongside release work:

- [Contributor setup](/contributors/setup)
- [Contributing code](/contributors/contributing-code)
- [Contributor topics](/contributors/topics/)
- [Contributor how-to guides](/contributors/how-to/)
