# Changesets

Hello and welcome! This folder contains [Changesets](https://github.com/changesets/changesets) which is a way of managing your versioning and changelogs with a focus on monorepos.

## Creating a Changeset

To create a changeset, run:

```bash
pnpm changeset
```

This will prompt you to select which packages have changed and what type of change it is (major, minor, or patch).

The summary you write is later used to generate Tango's root `CHANGELOG.md` for stable releases.

Write that summary in the Markdown shape you want the changelog to preserve. The stable release script carries each changeset summary into the root changelog verbatim, so short bullets, short release-note paragraphs, and compact fenced examples can survive generation exactly as written.

## Releasing

Releases are handled automatically via GitHub Actions:

- **Stable releases**: Push to `main` triggers the release workflow, which versions the fixed package train, updates the root `CHANGELOG.md`, and commits the generated release artifacts back to `main`
- **Alpha releases**: Manually trigger the `Release` workflow from the Actions tab, specifying the branch to release from. Alpha publishes do not update the committed root changelog.
