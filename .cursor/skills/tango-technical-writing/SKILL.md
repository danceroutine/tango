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

**CRITICAL: STOP AND CREATE A TODO LIST ITEM FOR EACH STEP IN THIS WORKFLOW. FAILURE TO DO THIS DEGRADES PERFORMANCE**

1. State `Executing tango-technical-writing` before doing any other work.
2. Identify the document type and audience.
    - End-user docs
    - Contributor docs
    - Package README
    - Docstring
3. State the thesis of the page in one sentence.
    - What should the reader be able to do or understand by the end?
4. Identify the reader's likely questions before drafting.
    - What is the reader trying to do or understand?
    - What would they be confused about first?
    - Which adjacent abstractions are out of scope for this page?
5. Build a prerequisite roadmap before drafting.
    - List the concepts or abstractions the page will need.
    - For each one, ask what the reader must already understand for it to make sense.
    - Distinguish between the underlying concept and the Tango name for that concept.
    - Remove nodes that do not serve the page thesis.
    - Order the remaining nodes from prerequisite to dependent concept.
    - Keep the roadmap short and drafting-oriented. In most cases, use 3 to 7 nodes, not an exhaustive taxonomy.
    - Do not polish the roadmap endlessly. If it is good enough to govern first mentions and section order, move on.
6. For substantial documentation work, expose a roadmap checkpoint to the user before drafting.
    - This is required for new pages, major rewrites, README overhauls, and major restructuring work.
    - Share:
        - the page thesis
        - the assumed reader knowledge
        - the ordered roadmap
        - the major scope cuts
    - End the checkpoint by saying you will draft from that roadmap unless the user wants to redirect it.
    - Do not stall waiting for approval unless a risky scope decision or ambiguity genuinely requires it.
7. Verify behavior against current code or the current public contract.
8. Draft or rewrite from the reader's task, concept, or contract.
    - Lead with architectural or conceptual intent before mechanics.
    - In contributor docs, map that intent to concrete maintainer responsibilities.
    - Order sections so they answer the reader's likely questions in sequence.
    - Draft in the order established by the roadmap.
    - Introduce the concept before introducing the Tango term of art that names it, unless the term is explicitly part of the reader's assumed prior knowledge.
    - Ground example domains before relying on example nouns such as `Post`, `Comment`, or `User`.
    - For reference pages, organize the page around individual contracts and methods rather than export inventories.
    - When a method or contract is important enough to name, give it its own subsection and explain its behavior before or alongside the example.
    - When examples materially improve understanding, place fenced code blocks inside the relevant subsection instead of collecting them into a generic example dump.
9. Run a fresh-reader review before polishing the prose.
    - Read the draft linearly as the target audience.
    - After each section, ask what question the reader is likely asking at that point.
    - Mark every place where the reader would need to scan ahead to infer meaning.
    - Mark every term, example noun, or abstraction that appears before it is grounded.
    - Mark every place where the page answers a different question than the one the reader is likely asking.
    - If subagents are available, prefer delegating this pass to a subagent that has not seen the working conversation context.
    - Give that subagent a concrete persona tied to the audience. Example: `You are a new developer unfamiliar with Tango. Read this draft linearly and report where meaning is unclear, where terms appear before they are explained, where the page answers a question you were not asking yet, and where you had to scan ahead to understand the text.`
10. Rewrite immediately to remove every issue found in step 9.
11. Audit the draft for scope drift, non-sequiturs, and poorly grounded examples.
12. Rewrite immediately to remove every issue found in step 11.
13. Audit the revised draft for AI-style rhetoric, meta-commentary, defensive framing, and over-terse prose.
14. Rewrite immediately to remove every issue found in step 13.
15. Audit the revised draft for audience-mismatched implementation detail.
    - End-user docs, READMEs, and docstrings should avoid source-location narration and repo-tour language.
    - Contributor docs may include repository details only when those details are directly useful for maintenance work.
16. Rewrite immediately to remove every issue found in step 15.
17. Audit the revised draft for field-dump or type-mirroring prose.
18. Rewrite immediately to replace every dump with contract-level explanation.
19. Run the correct persona review.
20. Rewrite again if the persona review exposes gaps in clarity, pedagogy, or audience fit.
21. Finalize only after all audits pass. Do not stop after analysis if the next action is a rewrite.

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

For substantial documentation work, the agent must also expose a roadmap checkpoint in chat before drafting. Use this exact opening:

`Roadmap checkpoint:`

## Required Checks

1. Use the principles in `references/principles.md`.
2. Use the anti-pattern catalog in `references/anti-patterns.md`.
3. If the work is substantial, expose the roadmap checkpoint before drafting.
4. If the roadmap grows into taxonomy work instead of drafting guidance, collapse it and move on.
5. If a Tango term of art appears before the concept that makes it intelligible, rewrite again.
6. If a section introduces an abstraction before the roadmap has established its prerequisites, rewrite again.
7. If the first mention of a term relies on the writer's prior context instead of the reader's available context, rewrite again.
8. If subagents are available, use them for fresh-reader review when that gives you a cleaner audience simulation.
9. When you use a subagent for review, do not give it the full working conversation if the goal is to simulate a reader who has not seen it.
10. If a page about one abstraction starts answering questions about a different abstraction too early, rewrite again.
11. If an example noun is not semantically grounded before it is used, rewrite again.
12. If a section order does not match the reader's likely questions, rewrite again.
13. If a paragraph only makes sense because the writer already knows the surrounding conversation or codebase context, rewrite again.
14. If the reader would have to scan ahead to infer what a term means, rewrite again.
15. If the draft still sounds like it is announcing the explanation instead of delivering it, rewrite again.
16. If end-user docs or README text still sounds like a repo tour instead of framework documentation, rewrite again.
17. If the draft defines something primarily by what it is not, rewrite it in affirmative terms.
18. If a sentence uses contrastive `X, not Y` framing, rewrite it as a direct affirmative explanation.
19. If a sentence tells the reader that something is `simple`, `easy`, `obvious`, or similar, rewrite it to describe the structure directly rather than asserting how difficult it should feel.
20. If the draft relies on clipped sentences, label-and-colon scaffolding, or other outline-like shorthand where prose would teach better, rewrite it in fuller explanatory sentences.
21. If prose terminology does not match current exported contract names, rewrite with accurate names.
22. If the draft uses absolute language, verify that the claim is truly unconditional in the current contract. Rewrite only when capability flags, environment differences, or alternate execution paths make the statement misleading.
23. If a reference page collapses into a contract dump, the default remediation is a structural rewrite: split the page into contract- or method-level subsections, add fenced examples where they teach behavior, and explain each subsection in application-facing language.

## Persona Review

### End-user docs

- Does this help an application developer build, configure, or decide?
- Could a new developer unfamiliar with Tango read this linearly without needing prior conversation context?
- Does each section answer a question the reader is likely already asking?
- Does each first mention follow the roadmap order rather than the writer's preferred order?
- Does the page stay focused on its named subject rather than drifting into adjacent abstractions?
- Does it avoid repo-tour language?
- Does it explain when and why to use the abstraction?
- Are example domains grounded immediately?
- If subagents are available, has a fresh-reader review been done with a new-developer persona?

### Contributor docs

- Does it support maintenance work directly?
- Could a contributor unfamiliar with this subsystem follow the page without scanning ahead to infer basic terms?
- Does the page establish the conceptual role of each subsystem before naming contributor-facing contracts or files?
- Are repository details present only because they help maintainers do the job?
- Is the page precise enough to guide implementation or review work?
- Does it use current contract names consistently with the code?
- Does it connect architectural intent to concrete maintainer responsibilities?

### Package READMEs

- Does it work as an NPM front page?
- Does it explain what the package is, why it exists, and how to start?
- Does the opening introduce the job the package solves before introducing package-local terms of art?
- Does it stay focused on the package boundary instead of adjacent packages?
- Does it funnel clearly to the official docs?
- Could a reader who has never used Tango understand the opening section without outside context?

### Reference pages

- Does the page describe the public contract instead of dumping exports or type signatures?
- Does each major contract or method have its own subsection when readers need separate behavioral guidance?
- Do fenced examples sit next to the subsection they teach rather than appearing as a detached example dump?
- Does the prose explain when application code uses the contract, what it supplies, and what behavior it should expect?
- Does the page avoid telling the reader that something is simple or obvious instead of describing the structure directly?

### Docstrings

- Is it short enough for an IDE popup?
- Does it explain behavior and intended use without restating types?
- Is it durable against likely implementation churn?
- Would it still make sense to a developer who has not read the surrounding file yet?

## References

- `references/principles.md`
- `references/anti-patterns.md`
