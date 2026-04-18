---
name: tango-technical-writing
description: Use this skill when writing or revising Tango documentation, changelogs, package READMEs, or public-facing docstrings so the prose stays natural, pedagogical, audience-aware, and contract-accurate.
---

# Tango Technical Writing

## When to Use

Use this skill for:

- `docs/**/*.md`
- `CHANGELOG.md` and changelog-oriented release summaries
- package `README.md`
- public-facing JSDoc and docstrings

Do not use this skill for contributor-only code changes that do not touch technical prose.

## Operating Rules

1. State `Executing tango-technical-writing` before doing any other work.
2. Treat this skill’s companion reference docs as the style and review source of truth when they are available:
    - `references/principles.md`
    - `references/anti-patterns.md`
      These paths are relative to the skill directory (they are not expected to live at the repository root).
3. If those reference files cannot be located (for example, the skill was copied without its `references/` directory), continue using the embedded rules in this skill and note reduced certainty.
4. Optimize first for reader clarity and contract accuracy, then for style polish.
5. Verify behavior against current code or the current public contract before making claims about behavior, guarantees, names, or responsibilities.
6. Perform every review pass against the current full draft text, not against memory or a summary of the draft.
7. When a review pass finds problems, fix them before moving to the next pass.

## Priority Order

When instructions compete, use this order:

1. Verified code and current public contract
2. The user’s requested task and scope
3. Audience fit and reader comprehension
4. This skill’s required workflow
5. Default stylistic heuristics

## Work Modes

Choose the lightest mode that fits the task.

### Quick Mode

Use for:

- docstrings
- small wording fixes
- local paragraph rewrites
- short README edits that do not change structure

Required work:

- identify document type and audience
- verify names and behavior
- draft or revise
- run the required review passes for the material you changed
- finalize

Do not expose a roadmap checkpoint in Quick Mode unless the user asks for it.

### Standard Mode

Use for:

- section rewrites
- moderate README changes
- moderate how-to or topic-guide edits
- reference page rewrites that stay within the existing page shape

Required work:

- identify document type and audience
- state the page thesis
- build a short prerequisite roadmap
- verify names and behavior
- draft or revise
- run all required review passes
- finalize

Expose a roadmap checkpoint only when it would materially help the user track a structural rewrite.

### Deep Mode

Use for:

- new pages
- major rewrites
- README overhauls
- major restructuring work
- reference pages that need structural reorganization

Required work:

- identify document type and audience
- state the page thesis
- build a short prerequisite roadmap
- expose a roadmap checkpoint before drafting
- verify names and behavior
- draft or revise
- run all required review passes
- finalize

## Workflow

### 1. Identify the document type and audience

Choose the primary document type:

- end-user docs
- contributor docs
- changelog or release notes
- package README
- reference page
- docstring

State the target reader in practical terms.

Examples:

- application developer integrating a resource
- contributor maintaining migrations
- package evaluator on npm
- developer reading an IDE popup

### 2. State the page thesis

Write one sentence describing what the reader should be able to do or understand by the end.

Examples:

- “By the end of this page, the reader should understand when to use `ModelViewSet` and what contract it expects from application code.”
- “By the end of this page, the reader should know how to add filtering to a resource and how that public API policy maps into ORM predicates.”

### 3. Build a prerequisite roadmap

Build a short drafting-oriented roadmap. In most cases, use 3 to 7 nodes.

For each node:

- name the concept the reader needs
- distinguish the underlying concept from the Tango term of art when relevant
- keep only nodes that directly serve the thesis
- order them from prerequisite to dependent concept
- name the primary Tango layer
- name any planned cross-layer hand-offs

Do not turn the roadmap into a taxonomy exercise. Collapse it once it is good enough to govern first mentions and section order.

### 4. Expose a roadmap checkpoint when required

For Deep Mode, and for other substantial work when structure is changing, expose a checkpoint before drafting.

Use this exact opening:

`Roadmap checkpoint:`

Then share:

- the page thesis
- the assumed reader knowledge
- the ordered roadmap
- the major scope cuts
- the page’s primary Tango layer, if relevant
- any planned cross-layer hand-offs, if relevant

End by saying you will draft from that roadmap unless the user wants to redirect it.

Do not stall waiting for approval unless a risky scope decision or real ambiguity requires intervention.

### 5. Verify names, behavior, and contract boundaries

Before drafting claims about behavior, verify:

- public contract names
- exported names when exact naming matters
- layer ownership
- guarantees and constraints
- whether a statement is universal or capability-dependent

If code access is unavailable, treat the current public docs and visible contract as provisional sources of truth and keep claims appropriately scoped.

### 6. Draft from the reader’s job

Write from the reader’s task, concept, or contract.

Use these defaults:

- lead with architectural or conceptual intent before mechanics
- order sections around the reader’s likely questions
- introduce the concept before the Tango term of art unless the term is already assumed knowledge
- ground example domains before using example nouns such as `Post`, `Comment`, or `User`
- surround commands and code with orienting prose so the reader knows why the snippet matters
- keep one page about one task, concept, or contract
- prefer public behavior over implementation detail
- prefer explanation over emphasis
- prefer affirmative framing over defensive framing
- prefer explicit reasoning over abstract significance markers

### 7. Apply Tango layer language discipline

Treat Tango’s default vertical architecture as:

1. Host Framework
2. Adapter Layer
3. Resource Layer
4. ORM Layer
5. Persistence Layer

Use the page’s primary layer to choose nouns and verbs.

When prose needs another layer’s vocabulary:

- add a hand-off before using it
- name the current layer’s concept
- explain why the next layer is now relevant
- then introduce the target layer’s term

For cross-layer workflows such as migrations, OpenAPI generation, CLI scaffolding, and testing:

- name the workflow first
- name the layers it crosses
- only then mix vocabulary from those layers

Qualify shared verbs such as `filter`, `validate`, `dispatch`, `register`, `execute`, and `hydrate` so the owning layer is clear.

### 8. Organize by document type

#### End-user docs

Optimize for:

- usage
- concepts
- workflows
- public contracts
- decisions an application developer needs to make

Avoid:

- source-location narration
- package barrel explanations
- repository-tour language
- implementation-tour narration that does not help the reader build or decide

#### Contributor docs

Optimize for:

- architectural intent mapped to concrete maintainer responsibilities
- maintenance workflow
- release workflow
- implementation constraints
- repository details only when they reduce maintainer ambiguity

#### Changelog and release notes

Treat changelog writing as upgrade-oriented release communication.

The target reader is:

- a maintainer deciding whether to upgrade now
- an application developer scanning for new capabilities, fixes, or contract changes
- a contributor reconstructing the release arc after the fact

Optimize for:

- user-visible capability changes
- observable behavior changes
- public API and contract changes
- upgrade-relevant release framing
- scan speed

Do not optimize for:

- implementation archaeology
- internal refactor narration
- package-by-package bookkeeping presented as prose
- marketing voice

When writing an individual changelog note:

- explain the change to a reader with zero context
- lead with the new capability, behavior change, or fix
- keep one note about one release-facing change
- prefer outcome language over implementation language
- use exact API names only when they help the reader recognize the feature
- mention internal mechanics only when they explain observable behavior, compatibility, or upgrade risk

When shaping a full release:

- write a short release thesis when the release has a coherent feature arc
- use the thesis to explain what ties the release together
- keep the tone explanatory rather than promotional
- order notes so they support the release thesis instead of reading like unrelated scraps

Default release-thesis guidance:

- patch releases usually do not need a thesis unless one clear upgrade concern dominates the release
- minor releases should usually include a short 1 to 3 sentence thesis
- larger feature releases may include a thesis plus grouped bullets by theme

For Tango's current lockstep release model, omit package-by-package impact lists from changelog prose.

If a future release workflow needs package-specific release notes:

- keep package detail secondary to the release-facing explanation
- do not let package metadata carry the meaning of the note

Use illustrative fenced examples only when they materially improve changelog comprehension.

Examples are appropriate when:

- the release adds major functionality
- the release changes a public API or contract in a way that is easiest to show in code
- the upgrade benefit can be shown in a compact diff or side-by-side comparison

Examples are usually not appropriate when:

- the release is a patch with small bug fixes
- the change is docs-only or internal-only
- the benefit cannot be shown honestly in a short snippet

When using illustrative examples:

- treat them as evidence, not decoration
- prefer one example per release, or one per major release theme
- show the public API delta, not internal setup
- keep the `Previously` and `Now` blocks on the same task or workflow so the contrast is immediate
- keep snippets short enough to scan quickly
- verify that every snippet is contract-accurate for the release being described
- prefer `Previously` and `Now`, or `Without this release` and `With this release`, when a literal `Before` and `After` would misrepresent the older API
- use short comments when they make the upgrade win legible at a glance
- for transaction or consistency releases, place comments at the point where a thrown exception or eager side effect would leave the workflow partially applied
- for typing releases, add comments that show the relevant inferred result shape or the property access that now succeeds or fails
- do not add decorative comments that merely restate the code
- if a `Previously` block does not make the missing capability, missing type information, or failure mode obvious, rewrite it until the contrast is explicit

If changelog content is generated from terse source notes, keep individual source notes concise and place release storytelling, grouped framing, and fenced examples in a release-level summary surface rather than forcing them into raw bullet text.

#### Package READMEs

Treat each README as:

- an npm landing page
- a mini-documentation page
- a funnel into the official docs

The opening should explain what the package is and why its boundary exists in the same section.

#### Reference pages

Organize around contracts and behaviors, not export inventories.

When a contract or method is important enough to name, give it its own subsection and explain:

- when application code uses it
- what application code supplies
- what behavior the reader should expect

Put fenced examples next to the subsection they teach rather than collecting them into a detached example dump.

#### Docstrings

Keep docstrings short enough for IDE popups.

Explain:

- behavior
- intended use
- relevant boundaries when needed

Do not restate types unless the type alone would leave the behavior unclear.

## Required Review Pipeline

Run these passes in order against the current full draft text.

### Pass 1: Structural Verification

Check that the draft still matches:

- the page thesis
- the ordered roadmap
- the intended audience
- the chosen document type
- the page’s primary Tango layer, if relevant

If any major section violates the roadmap or answers a different question too early, fix structure before continuing.

### Pass 2: Anti-Pattern Review

Use the anti-pattern section headings from `references/anti-patterns.md` when available.

During anti-pattern review, announce each pass in chat with this exact template before checking:

`I am now checking for instances of <anti-pattern>.`

For each anti-pattern pass:

1. inspect the current full draft text
2. enumerate candidate sentences or paragraphs that may match the pattern
3. classify each candidate as:
    - valid
    - violation
    - ambiguous

4. rewrite every violation and ambiguous case before continuing
5. do not mark the pass complete unless all candidates for that pass have been enumerated

If a pass finds no candidates, state that no candidates were found.

Do not use “I checked” as a substitute for findings.

#### Detection rule

When a pattern is surface-detectable, enumerate candidates explicitly.

Examples of surface-detectable patterns include:

- negative-opening sentences
- contrast formulas such as `It’s not X, it’s Y`
- contrastive comma clauses such as `X, not Y`
- defensive framing
- meta-intros
- label-and-colon scaffolding
- universal or absolute language
- field dumps and type dumps

When a pattern is semantic, produce a concrete defect report rather than a yes-no judgment.

Examples of semantic patterns include:

- scope drift
- sequencing failures
- reader-experience breaks
- layer vocabulary bleed
- contract-name drift when code verification is required to confirm it

### Pass 3: Mandatory Surface Checks

Run these extraction-based checks even if the broader anti-pattern pass seemed clean.

#### Contrastive Framing Pass

Inspect the current full draft sentence by sentence.

Quote every sentence containing any of:

- `not`
- `rather than`
- `instead of`
- `unlike`
- `as opposed to`
- `isn't`
- `aren't`
- `doesn't`
- `don't`
- `can't`

For each quoted sentence, classify it as:

- required literal negation for technical correctness
- contrastive teaching rhetoric
- ambiguous

Rewrite every sentence in the last two categories into affirmative prose.

Do not claim this pass is complete unless every candidate sentence has been enumerated.

If zero candidates are found, state:

`Contrastive framing candidates found: 0`

#### Meta-Intro and Scaffolding Pass

Quote every sentence that resembles:

- `This page...`
- `This guide...`
- `This section...`
- `The official docs live here:`
- similar explanation-announcing scaffolding

Rewrite each case into direct explanation unless the phrase is required for navigational clarity.

#### Absolute Language Pass

Quote every sentence containing any of:

- `always`
- `never`
- `all`
- `only`
- `every`
- `none`
- `without any additional consideration`
- other universal language that may overstate the contract

For each candidate:

- verify whether the claim is truly unconditional
- narrow the claim if constraints exist
- retain absolute language only when the verified contract is unconditional

#### Repo-Tour and Maintainer Leakage Pass

Quote every sentence that references:

- file paths
- package paths
- barrels or exports as navigation
- repository structure
- “authoritative source” language
- source locations

For end-user docs, READMEs, and docstrings, rewrite those sentences into role language unless the location is directly necessary for the reader’s task.

### Pass 4: Reader Persona Defect Report

Read the current draft linearly as the target audience.

Do not answer this pass with general approval. Produce defects.

At minimum, report:

1. the first sentence where meaning becomes unclear, if any
2. the first term of art that appears before grounding, if any
3. the first place where the reader would need to scan ahead, if any
4. the first section that answers a different question than the reader is likely asking, if any
5. one place where detail level mismatches the audience, if any

Fix every reported defect before continuing.

If subagents or equivalent independent-review tooling are available and useful, use them for this pass. Do not provide them the whole working conversation when the goal is to simulate a fresh reader.

If such tooling is unavailable, perform the persona reread yourself.

### Pass 5: Adversarial Verification

If independent-review tooling is available and policy permits using it, use it for this pass. Otherwise, perform the adversarial review yourself.

Try to produce up to 5 concrete failure claims. Do not invent a claim if the draft does not support one.

Examples:

- a term appears before the concept that makes it intelligible
- a paragraph uses another layer’s vocabulary without a hand-off
- a section drifts into an adjacent abstraction too early
- a sentence overstates a guarantee
- a contract name may not match the public API
- a code block appears before the reader knows why it matters

For each claim, either:

- fix the draft, or
- rebut the claim using quoted draft text plus verified contract evidence

Finalize only after all listed claims are resolved.

## Required Anti-Pattern Coverage

When `references/anti-patterns.md` is available, run a pass for each of its section headings.

The required anti-pattern names are currently:

- AI-Style Rhetoric
- Maintainer Leakage in End-User Docs
- Scope Drift and Sequencing Failures
- Reader-Experience Breaks
- Layer Vocabulary Bleed
- Contract-Name Drift
- Overstated Guarantees
- Field Dumps and Type Dumps

Use those section headings as the `<anti-pattern>` value in the observability template.

## Evidence Requirements

A review pass is not complete unless it produces evidence.

Valid evidence includes:

- quoted candidate sentences or paragraphs
- explicit classifications
- rewrites
- defect reports tied to specific draft text
- contract verification tied to exact claims

Invalid evidence includes:

- “looks good”
- “checked”
- “all clear” without candidate enumeration where enumeration is required
- summary judgments that do not identify the text being judged

## Completion Rule

Finalize when all of the following are true:

1. the draft matches verified code or the current public contract
2. the opening states or strongly implies what the page helps the reader do or understand
3. major terms appear in prerequisite order
4. section order follows the reader’s likely questions
5. cross-layer vocabulary is either absent or introduced with a hand-off
6. examples are grounded before they are used
7. no unresolved material defects remain from the review passes
8. the draft no longer relies on meta-intros, defensive framing, rhetorical contrast formulas, or dump-style prose where direct explanation would teach better

Do not continue polishing once these conditions are met unless the user requests deeper refinement.

## Principles Summary

Use the principles in `references/principles.md`.

The most important defaults are:

- start from the concept, task, or contract itself
- write for the reader’s job, not the author’s familiarity with the repo
- build a prerequisite roadmap before drafting
- order sections around the reader’s likely questions
- keep one page about one task, concept, or contract
- prefer public behavior over implementation detail
- prefer explanation over rhetorical emphasis
- prefer affirmative framing over defensive framing
- prefer explicit reasoning over abstract importance markers
- prefer connected explanatory prose over clipped outline syntax when the material is not inherently list-shaped
- ground example domains before relying on example nouns
- use current exported contract names consistently
- scope guarantees to supported behavior and capability constraints when relevant
- documentation should be timeless and describe how things are now

## Default Rewrite Direction

When a sentence or section feels wrong, move it in this direction:

- from meta-commentary to direct explanation
- from repository detail to public contract in end-user docs, READMEs, and docstrings
- from slogan-like emphasis to explicit reasoning
- from defensive negation to affirmative role language
- from outline-like scaffolding to continuous explanatory prose
- from field dump to role and behavior
- from maintainer voice to reader-task voice

## Minimal Examples of Good Transformations

### Meta-intro to direct explanation

Before:

`This page explains how filtering works.`

After:

`Filtering lets a resource expose a stable query interface without passing arbitrary query strings into the ORM.`

### Negative contrast to affirmative role language

Before:

`It is not an HTTP framework. Tango lives inside Express or Next.js.`

After:

`Tango provides the application-facing layers while Express or Next.js continues to own routing and request lifecycle behavior.`

### Contrastive comma clause to direct explanation

Before:

`These are contract surfaces, not incidental constants.`

After:

`These are contract surfaces and should be treated as deliberate, reviewable parts of Tango's public behavior.`

### Maintainer leakage to role language

Before:

`The class is implemented in packages/resources/src/viewset/ModelViewSet.ts.`

After:

`ModelViewSet is the abstract base class for manager-backed CRUD resources.`

### Field dump to contract explanation

Before:

`Config fields: manager, readSchema, writeSchema, updateSchema, filters, orderingFields, searchFields.`

After:

`Application code supplies the manager and the schemas that define the resource contract. Optional filtering, ordering, and search settings refine the public API.`

## Final Reminder

This skill exists to produce documentation that teaches clearly and survives contact with a fresh reader.

Do not confuse visible process with verified quality. The required process is there to force evidence-backed checking, not to replace judgment.
