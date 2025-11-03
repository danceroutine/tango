# Changesets

Hello and welcome! This folder contains [Changesets](https://github.com/changesets/changesets) which is a way of managing your versioning and changelogs with a focus on monorepos.

## Creating a Changeset

To create a changeset, run:

```bash
pnpm changeset
```

This will prompt you to select which packages have changed and what type of change it is (major, minor, or patch).

## Releasing

Releases are handled automatically via GitHub Actions:

- **Stable releases**: Push to `main` triggers the release workflow which creates a PR to version packages or publishes if the PR is merged
- **Alpha releases**: Manually trigger the `release-alpha.yml` workflow from the Actions tab, specifying the branch to release from
