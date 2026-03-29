---
name: tango-technical-writing
description: Use this skill when writing or revising Tango documentation, package READMEs, or public-facing docstrings so the prose stays natural, pedagogical, and audience-aware.
---

# Tango Technical Writing

## When to Use

Use this skill for:

- `docs/**/*.md`
- package `README.md`
- public-facing JSDoc and docstrings

Do not use this skill for contributor-only code changes that do not touch technical prose.

## Workflow

1. State `Executing tango-technical-writing` before doing any other work.
2. Identify the document type and audience.
    - End-user docs
    - Contributor docs
    - Package README
    - Docstring
3. Verify behavior against current code or the current public contract.
4. Draft or rewrite from the reader's task, concept, or contract.
    - Lead with architectural or conceptual intent before mechanics.
    - In contributor docs, map that intent to concrete maintainer responsibilities.
5. Audit the draft for AI-style rhetoric, meta-commentary, defensive framing, and over-terse prose.
6. Rewrite immediately to remove every issue found in step 5.
7. Audit the revised draft for audience-mismatched implementation detail.
    - End-user docs, READMEs, and docstrings should avoid source-location narration and repo-tour language.
    - Contributor docs may include repository details only when those details are directly useful for maintenance work.
8. Rewrite immediately to remove every issue found in step 7.
9. Audit the revised draft for field-dump or type-mirroring prose.
10. Rewrite immediately to replace every dump with contract-level explanation.
11. Run the correct persona review.
12. Rewrite again if the persona review exposes gaps in clarity, pedagogy, or audience fit.
13. Finalize only after all audits pass. Do not stop after analysis if the next action is a rewrite.

## Observability Protocol

During anti-pattern audits, the agent must announce each audit pass in chat with this exact template before checking:

`I am now checking for instances of <anti-pattern>.`

Source of truth for anti-pattern names:

- `references/anti-patterns.md`
- Use the anti-pattern section headings as the `<anti-pattern>` value.

Required anti-pattern passes are therefore the anti-pattern sections currently defined in `references/anti-patterns.md`.

For each pass, the agent must:

1. state exactly `I am now checking for instances of <specific pattern>`,
2. check the draft for that anti-pattern
3. fix every instance found before continuing to the next pass

## Required Checks

- Use the principles in `references/principles.md`.
- Use the anti-pattern catalog in `references/anti-patterns.md`.
- If the draft still sounds like it is announcing the explanation instead of delivering it, rewrite again.
- If end-user docs or README text still sounds like a repo tour instead of framework documentation, rewrite again.
- If the draft defines something primarily by what it is not, rewrite it in affirmative terms.
- If a sentence uses contrastive `X, not Y` framing, rewrite it as a direct affirmative explanation.
- If the draft relies on clipped sentences, label-and-colon scaffolding, or other outline-like shorthand where prose would teach better, rewrite it in fuller explanatory sentences.
- If prose terminology does not match current exported contract names, rewrite with accurate names.
- If the draft makes absolute guarantees where capabilities or environment constraints apply, rewrite with scoped claims.

## Persona Review

### End-user docs

- Does this help an application developer build, configure, or decide?
- Does it avoid repo-tour language?
- Does it explain when and why to use the abstraction?

### Contributor docs

- Does it support maintenance work directly?
- Are repository details present only because they help maintainers do the job?
- Is the page precise enough to guide implementation or review work?
- Does it use current contract names consistently with the code?
- Does it connect architectural intent to concrete maintainer responsibilities?

### Package READMEs

- Does it work as an NPM front page?
- Does it explain what the package is, why it exists, and how to start?
- Does it funnel clearly to the official docs?

### Docstrings

- Is it short enough for an IDE popup?
- Does it explain behavior and intended use without restating types?
- Is it durable against likely implementation churn?

## References

- `references/principles.md`
- `references/anti-patterns.md`
