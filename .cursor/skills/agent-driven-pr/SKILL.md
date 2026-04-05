---
name: agent-driven-pr
description: Use only when the user explicitly asks for an agent-driven PR workflow. Handles syncing with origin/main, creating a semantically named branch, validating and committing with a conventional commit, opening a PR, watching GitHub checks, waiting five real-time minutes for reviews, addressing actionable review feedback, resolving unactionable threads, and merging once checks and discussions are complete.
---

# Agent-Driven PR

Use this skill only on explicit user request. Do not trigger it implicitly for ordinary coding tasks.

## Workflow

1. Announce `Executing agent-driven-pr`.
2. Confirm scope from the current worktree.
    - Run `git status --short --branch`.
    - If unrelated changes exist, stop and ask the user how to handle them.
3. Sync with the default branch.
    - Run `git fetch origin`.
    - Check out `main`.
    - Run `git pull --ff-only origin main`.
4. Create a new semantically named branch from updated `main`.
    - Use a concise branch such as `fix/<topic>`, `refactor/<topic>`, or `feat/<topic>`.
5. Implement the requested work.
6. Run the most relevant validation before committing.
    - Prefer the narrowest commands that actually cover the change.
    - If release or CI automation changed, include the relevant workflow or release checks.
7. Commit with a conventional commit message.
    - Use `fix: ...`, `feat: ...`, `refactor: ...`, `docs: ...`, or another appropriate conventional prefix.
8. Push the branch with tracking.
    - `git push -u origin <branch>`
9. Create the pull request.
    - Use `gh pr create` or GitHub MCP tools.
    - Base branch should be `main` unless the user explicitly says otherwise.
    - Include a concise body covering what changed, why, and validation.
10. Babysit GitHub Actions and required checks.

- Watch the PR checks to completion.
- If a check fails, inspect the failure, fix it locally, rerun relevant validation, amend or follow up, and push again.
- If you amended history after the branch was already pushed, use `git push --force-with-lease` instead of a plain push.

11. After all checks are green, wait five real-time minutes for review comments.

- Do not merge immediately.

12. Inspect review feedback.

- Address actionable comments with code changes.
- Close or resolve unactionable review threads when the platform permits and the rationale is clear.
- Re-run relevant validation after each review-driven change.
- Push updates and re-babysit checks until the PR is green again.

13. Merge only when all of the following are true:

- required checks passed
- actionable review feedback addressed
- discussion threads resolved or explicitly closed as unactionable
- branch policy allows merge

14. Merge the PR to `main`.

- Prefer the repository's normal merge strategy.

15. Verify post-merge state.

- Ensure local `main` fast-forwards to the merged commit.
- Check post-merge GitHub runs on `main` if the change touches CI, release, or deployment behavior.
- If the task includes a known recovery action, execute it and confirm the repository returns to a healthy state.

## Safety rules

- Do not trigger this workflow unless the user explicitly asks for `agent-driven-pr` or plainly requests the full branch/PR/babysit/merge loop.
- Do not silently include unrelated working tree changes.
- Do not skip validation before committing.
- Do not merge while required checks are still pending or failing.
- Do not merge while unresolved actionable review threads remain.
- Prefer amending or follow-up commits only as needed to keep the PR coherent; follow the user's repo norms when they are known.

## Review handling

Treat review comments in three buckets:

- `actionable`: requires code or docs changes; fix and validate
- `explanatory`: answer by clarifying behavior or updating docs if needed
- `unactionable`: resolve or close when the feedback is incorrect, obsolete, or already addressed

When a review comment reveals a real bug in the current branch, fix the bug even if the original implementation was locally green.

## Reporting

At the end, report:

- branch name
- commit SHA that landed
- PR number and URL
- validation that ran
- whether post-merge `main` is healthy
