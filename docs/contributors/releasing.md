# Releasing packages

Tango uses a single trusted-publishing workflow for stable and alpha releases. Maintainers should follow the release path in this guide and keep the listed files aligned with it.

## Before you begin

Run the same quality gates that CI expects:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:integration:all
```

If any of those commands fail, treat the failure as a release blocker rather than as something to revisit after publishing.

## Release channels and triggers

The release workflow lives in `.github/workflows/release.yml` and supports two channels:

- stable release flow
- alpha snapshot flow

Stable runs are triggered by pushes to `master` and can also be triggered manually with `workflow_dispatch` for `master`. Alpha runs are triggered manually with `workflow_dispatch` and `release_type=alpha`.

## Stable release flow

Stable releases are changeset-driven and include root changelog generation.

1. Ensure releasable pull requests include changesets (`pnpm changeset`).
2. Merge releasable work to `master`.
3. Let the release workflow run `pnpm changeset:version`.
4. If versioning produces a diff, the workflow mints a token from the installed release GitHub App and uses that app identity to commit the generated version changes directly to `master` with a bot-authored `[skip ci]` commit so the follow-up push does not start a second release run.
5. The same workflow run publishes the freshly versioned packages through trusted publishing.

The stable versioning step runs `pnpm changeset:version`, which executes `scripts/release/version-with-root-changelog.ts`. That helper:

- runs `changeset version`
- refreshes the lockfile
- updates the root `CHANGELOG.md`

`CHANGELOG.md` is generated as part of this path and should not be manually edited.

## Alpha release flow

Alpha releases use snapshot versioning and publish with the `alpha` tag.

The workflow path is:

1. run workflow manually with `release_type=alpha`
2. version packages as a snapshot (`changeset version --snapshot ...`)
3. build packages
4. publish snapshots with `changeset publish --snapshot --tag alpha`

Alpha releases intentionally leave `CHANGELOG.md` unchanged.

## Workspace dependencies

Internal dependencies declared as `workspace:*` are rewritten to concrete published versions during release. Tango's public packages are also versioned together as one fixed release train, so generated stable release commits should show the same version across the published workspace packages.

## Files that must stay in sync

When the release process changes, update these files together:

- `.github/workflows/release.yml`
- `.changeset/config.json`
- `scripts/release/version-with-root-changelog.ts`
- root `package.json` release scripts (`changeset:version` and `changeset:publish`)
- repository Actions variables/secrets for the release GitHub App (`RELEASE_APP_ID` and `RELEASE_APP_PRIVATE_KEY`)
- this page

`CHANGELOG.md` should be treated as generated output from the stable release flow rather than as a manually maintained source file.
