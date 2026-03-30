---
name: tango-release-workflow
description: Execute Tango release operations for stable and alpha channels using the current GitHub Actions trusted publishing flow. Use when maintainers need to prepare, run, or verify a release and require explicit guidance checkpoints before irreversible steps (workflow dispatch and publish).
---

# Tango Release Workflow

Execute this workflow when creating a Tango release.

## Workflow

1. Announce `Executing tango-release-workflow`.
2. Read current release sources of truth before taking action:
    - `docs/contributors/releasing.md`
    - `.github/workflows/release.yml`
    - root `package.json` scripts: `changeset:version`, `changeset:publish`
    - `.changeset/config.json`
3. Ask maintainer guidance checkpoint #1:
    - "Which channel should we run: stable or alpha?"
4. Ask maintainer guidance checkpoint #2:
    - "Should we run full local preflight gates now, or rely on CI for final enforcement?"
5. Run or skip local preflight based on checkpoint #2 decision.
6. Branch to the selected release channel workflow.
7. Stop at every required checkpoint before irreversible actions.
8. Finish with a release summary including what ran, what was skipped, and what human action remains.

## Local Preflight (when requested)

1. Verify workspace state:
    - Confirm branch and working tree status.
    - Call out unrelated local changes before proceeding.
2. Run quality gates expected by release docs:
    - `pnpm typecheck`
    - `pnpm lint`
    - `pnpm test`
    - `pnpm build`
    - `pnpm test:integration:all`
3. If any gate fails, stop and ask maintainer guidance:
    - "Preflight failed. Do you want to fix now, defer, or abort release?"

## Stable Channel Path

1. Confirm changeset readiness:
    - Ensure releasable PRs include changesets.
    - If uncertain, run `pnpm changeset status --since=origin/master` when available.
2. Ask maintainer guidance checkpoint #3:
    - "Choose stable trigger path: push-to-master flow, or manual workflow_dispatch stable run on master?"
3. If manual stable dispatch is chosen, confirm that `master` is the target branch before dispatch.
4. Trigger or wait for the `Release` workflow according to checkpoint #3.
5. Verify the generated stable release commit and workflow output:
    - public Tango packages share one synchronized version
    - `CHANGELOG.md` changed via generated stable notes
    - lockfile and version bumps are coherent
6. Verify publish job outcome:
    - workflow success
    - npm publish completed via trusted publishing
7. Ask maintainer guidance checkpoint #5:
    - "Do you want a post-release validation pass (npm package/version spot checks)?"

## Alpha Channel Path

1. Ask maintainer guidance checkpoint #3:
    - "Which branch should be released as alpha?"
2. Trigger `Release` workflow with:
    - `release_type=alpha`
    - selected branch
3. Verify alpha path behavior:
    - snapshot versioning ran
    - build step ran
    - publish used `--snapshot --tag alpha`
    - `CHANGELOG.md` remained unchanged
4. Ask maintainer guidance checkpoint #4:
    - "Do you want alpha verification on npm tags now?"

## Checkpoint Prompt Style

Use concise, decision-oriented prompts at each checkpoint.

- Prefer direct choices over open-ended questions.
- Include consequence in one short sentence.
- Wait for maintainer decision before continuing.

Example prompts:

- "Stable or alpha?"
- "Run full local preflight now or skip to workflow?"
- "Run post-release npm validation?"

## Validation and Reporting

1. Report exact commands run and their outcomes.
2. Report any skipped checks and why they were skipped.
3. Report pending manual actions (if any).
4. If release artifacts differ from expected behavior, stop and escalate with a concrete mismatch summary.
