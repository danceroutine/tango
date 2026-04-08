# Anti-Patterns

## Purpose

This catalog defines the documentation failures Tango prose should avoid.

Each anti-pattern section names the failure, explains why it harms the reader,
shows how to inspect for it, and gives rewrite direction. These are writing
quality standards, not workflow instructions. The skill or review process may
impose additional audit mechanics, but the source of truth for what counts as an
anti-pattern lives here.

When multiple anti-patterns seem to apply, classify the problem by its primary
failure mode:

- use **AI-Style Rhetoric** for sentence-level rhetorical habits and
  explanation-announcing scaffolding
- use **Maintainer Leakage in End-User Docs** for repository or implementation
  narration in docs meant for application readers
- use **Scope Drift and Sequencing Failures** for page structure and
  section-order problems
- use **Reader-Experience Breaks** for local comprehension failures inside the
  current sequence
- use **Layer Vocabulary Bleed** for cross-layer terminology ownership failures
- use **Contract-Name Drift** for naming errors against the public API
- use **Overstated Guarantees** for claims whose scope exceeds the verified
  contract
- use **Field Dumps and Type Dumps** for prose that mirrors structure without
  teaching behavior

## Detection Types

Each anti-pattern includes a detection type.

### Surface-detectable

These patterns usually have lexical or sentence-shape cues and can be found by
enumerating candidate text directly.

### Semantic review required

These patterns require linear reading, audience simulation, contract
verification, or structural judgment.

A pattern may have both kinds of cues. When in doubt, start with surface cues and
then perform semantic review.

---

## AI-Style Rhetoric

**Detection type:** surface-detectable

### What it is

AI-Style Rhetoric is prose that sounds like it is announcing an explanation,
signaling posture, or performing clarity rather than delivering clarity through
direct teaching.

This category is about sentence-level rhetoric, not about page structure or
conceptual sequencing.

### Why it harms the reader

These patterns add noise, flatten tone, and create the feeling that the prose is
circling the point instead of making it. They also tend to hide weak reasoning
behind a polished cadence.

### Common patterns

Avoid these patterns:

- negative-opening sentences such as `It is not X`
- contrast formulas such as `It's not X, it's Y`
- contrastive comma clauses such as `X, not Y`
- defensive framing such as `It does not replace them`
- short emphatic fragments such as `That matters.`
- clipped underdeveloped sentences that sound like rhetorical beats instead of
  explanation
- rhetorical self-labeling such as `Honest version`, `The brutal truth`,
  `Frankly`
- meta-intros such as `This page...`, `This guide...`, `This section...`
- summary scaffolding such as `X is summarized here` or `Y is described here`
- label-and-colon scaffolding such as `The official docs live here:`, `Docs:`,
  `Examples:`, or `The command:` when a full sentence would teach more clearly

### Inspection cues

Start by quoting sentences that contain:

- `not`
- `rather than`
- `instead of`
- `unlike`
- `as opposed to`
- `this page`
- `this guide`
- `this section`
- label-and-colon scaffolding such as `Docs:`, `Examples:`, or `The command:`
- short standalone emphasis sentences
- posture-signaling phrases

Then inspect whether the sentence teaches directly or merely frames the teaching.

### Borderline valid cases

These are usually valid when they serve technical precision rather than
rhetorical posture:

- literal negation required for correctness
- explicit distinction where the negative form is the clearest accurate
  statement
- concise navigational prose when the page genuinely needs orientation rather
  than explanation

Even in valid cases, prefer direct explanation when it teaches better.

### Rewrite direction

- Start with the claim itself.
- Put the reasoning in the same sentence or the next one.
- State the role the thing does play instead of defining it mainly by what it
  does not do.
- Replace posture-signaling phrases with concrete explanation.
- Replace outline-like fragments with complete explanatory sentences when the
  material is not inherently list-shaped.

### Examples

#### Negative-opening contrast

Before:

`It is not an HTTP framework. Tango lives inside Express or Next.js.`

After:

`Tango provides the application-facing layers while Express or Next.js continues to own routing and request lifecycle behavior.`

#### Contrastive comma clause

Before:

`These are contract surfaces, not incidental constants.`

After:

`These are contract surfaces and should be treated as deliberate, reviewable parts of Tango's public behavior.`

#### Defensive framing

Before:

`Tango runs inside host frameworks such as Express and Next.js. It does not replace them.`

After:

`Tango enhances the frameworks you are already using with application workflows inspired by Django, while continuing to work in tandem with your preferred host framework.`

#### Meta-intro

Before:

`This page explains how filtering works.`

After:

`Filtering lets a resource expose a stable query interface without passing arbitrary query strings into the ORM.`

#### Outline-like scaffolding

Before:

`The official docs live here:`

After:

`The official documentation walks through Tango from first principles and is the best place to start when you are evaluating the framework or building with it.`

---

## Maintainer Leakage in End-User Docs

**Detection type:** surface-detectable with semantic confirmation

### What it is

Maintainer leakage happens when end-user docs, READMEs, or docstrings speak in
repository-maintainer terms instead of reader-task terms.

This category is about inappropriate repository or implementation narration in
documents meant to help application developers build, configure, or decide.

### Why it harms the reader

It shifts the document away from the reader's job and toward the author's
familiarity with the codebase. The reader came to understand behavior or
complete a task, not to tour the repository.

### Common patterns

Avoid these patterns in end-user docs:

- `implemented in packages/...`
- `the authoritative source is ...`
- export-barrel narration
- repository-tour explanations
- source-location narration when the reader is trying to build something

Contributor docs may include repository locations when that detail directly
helps maintainers implement, test, or review a change.

### Inspection cues

Quote sentences that reference:

- file paths
- package paths
- barrels or re-exports
- repository directories
- source locations
- repository navigation as explanation

Then ask whether the sentence helps the target reader do their job or merely
exposes author-side orientation.

### Borderline valid cases

These are often acceptable:

- contributor docs where repository structure reduces ambiguity
- migration or maintenance docs where source location is part of the task
- narrowly targeted troubleshooting where the reader genuinely needs the exact
  source surface

### Rewrite direction

- Replace file-location language with role language.
- Explain what the abstraction does, when to use it, and how it fits into the
  workflow.
- Keep repository details only when the document type and reader task justify
  them.

### Example

Before:

`The class is implemented in packages/resources/src/viewset/ModelViewSet.ts.`

After:

`ModelViewSet is the abstract base class for manager-backed CRUD resources.`

---

## Scope Drift and Sequencing Failures

**Detection type:** semantic review required

### What it is

Scope drift happens when a page starts teaching a different concept than the one
it is nominally about. Sequencing failure happens when the page answers questions
out of order, introduces adjacent abstractions too early, or interrupts the main
thread with comparisons or details the reader is not ready for.

This category is about page structure and section order, not about
sentence-level style.

### Why it harms the reader

It makes the document feel slippery. The reader starts on one track and is forced
onto another before the first one is stable. This raises cognitive load and often
causes scan-ahead behavior.

### Common patterns

Avoid these patterns:

- answering a question the reader is not asking yet
- introducing adjacent abstractions before the page has explained its named
  subject
- letting a page about one abstraction drift into a different abstraction
- non-sequitur comparison paragraphs that interrupt the main task
- unexplained example nouns such as `Post` when the reader has not yet been told
  what the example domain is
- strong opening prose followed by abrupt, under-explained command or code
  sections

### Inspection cues

To inspect for this pattern:

1. state the page thesis in one sentence
2. list the major sections in order
3. ask what question the reader is likely asking at the start of each section
4. mark sections that answer a different question than the reader is likely
   asking at that point
5. mark sections that belong to a neighboring abstraction rather than the named
   subject
6. mark code or command blocks that arrive before their purpose is explained

### Borderline valid cases

Some brief forward references are fine when they help orient the reader, but they
should not become full detours. A small preview is different from a structural
drift into another topic.

### Rewrite direction

- Derive section order from the reader's likely questions.
- Keep one page about one task, concept, or contract.
- Ground example domains immediately.
- Explain why the next code block or command matters before presenting it.
- Move adjacent abstractions to their own page unless the current task depends
  on them.

### Examples

#### Scope drift

Before:

`Serializer hooks are still useful when a model hook would be too broad for one endpoint.`

After:

`A common sign that a rule belongs on the model is that it begins in one write path and later needs to be enforced everywhere the record is created or updated.`

#### Ungrounded example

Before:

`Suppose posts should receive a slug and timestamps...`

After:

`Suppose your application includes a blog post model. Each blog post should receive a slug and timestamps...`

---

## Reader-Experience Breaks

**Detection type:** semantic review required

### What it is

Reader-Experience Breaks are local comprehension failures that make a sentence
or paragraph hard to understand in the moment, even if the page is broadly on
the right topic.

This category is about linear readability inside the current sequence. It is not
the place to classify page-level drift or sentence-level rhetoric.

### Why it harms the reader

The reader has to pause, infer missing context, or scan ahead to recover meaning.
Even one or two of these breaks can make otherwise correct prose feel harder
than the subject itself.

### Common patterns

Avoid these patterns:

- using a term that only makes sense if the reader already knows the surrounding
  conversation
- introducing a framework term of art before the underlying concept has been
  socialized
- requiring the reader to scan ahead to infer what a noun or phrase means
- giving an instruction before explaining why the reader should care about it
- using vague internal shorthand such as `this section of the model` when the
  concrete construct has not been named
- using abstract phrases such as `lifecycle rule` or `write paths` without
  grounding them in the current example

### Inspection cues

Read the page linearly as the target audience and report:

- the first sentence where meaning becomes unclear
- the first term of art that appears before grounding
- the first place where the reader would need to scan ahead
- the first instruction that appears before rationale
- the first vague noun phrase that relies on unstated context

### Borderline valid cases

A page can assume some prior knowledge if that knowledge is clearly part of the
document's audience contract. The failure is not "advanced content." The failure
is requiring hidden context the target audience has not been given.

### Rewrite direction

- Read the draft linearly as the target audience.
- Ask what the reader is likely wondering after each paragraph.
- Introduce the concept first, then the local framework name for that concept.
- Replace vague shorthand with the concrete construct the reader can see in code
  or in the example.
- Add the missing rationale before the instruction when the page currently jumps
  straight to the action.
- Rewrite any sentence that depends on scan-ahead for comprehension.

### Example

Before:

`Keep this section of the model responsible for recording those values.`

After:

`Keep this logic in the model hooks so the model records those values whenever the record is created or updated.`

---

## Layer Vocabulary Bleed

**Detection type:** semantic review required with some surface cues

### What it is

Layer Vocabulary Bleed happens when prose casually borrows nouns or verbs from
another Tango layer without marking the boundary crossing. The result is that
layer-specific concepts start reading like synonyms.

This category is about vocabulary ownership and hand-off discipline across
layers.

### Why it harms the reader

It obscures responsibility boundaries and makes cross-layer workflows harder to
reason about. Readers lose track of which abstraction owns which behavior.

### Common patterns

Avoid these patterns:

- using Persistence Layer nouns such as `table`, `row`, `column`, `SQL`, or
  `dialect` in ORM-layer prose before a hand-off
- using ORM Layer nouns such as `model`, `field`, `record`, or `QuerySet` in
  Persistence Layer prose before explaining the metadata source
- using Resource Layer nouns such as `serializer`, `request payload`,
  `response representation`, `FilterSet`, or `pagination` in ORM-layer prose
  before explaining the API-layer concern
- using Adapter Layer or Host Framework nouns in Resource Layer prose in a way
  that makes resources sound responsible for routing or request lifecycle
  behavior
- using shared verbs such as `filter`, `validate`, `dispatch`, `register`,
  `execute`, or `hydrate` without enough context to show which layer owns the
  action

### Inspection cues

To inspect for this pattern:

1. identify the page's primary layer
2. list nouns and verbs that belong to other layers
3. quote the first occurrence of each cross-layer term
4. verify that a hand-off sentence appears before or at that transition
5. verify that shared verbs are qualified enough to show which layer owns the
   action

### Borderline valid cases

Cross-layer workflows such as migrations, OpenAPI generation, CLI scaffolding,
and testing will intentionally mix vocabulary. That is acceptable when the
workflow and crossed layers are named before the mixed terminology appears.

### Rewrite direction

- Identify the page's primary layer.
- Rewrite with that layer's vocabulary as the default.
- Add a hand-off sentence before any necessary noun or verb from another layer.
- For cross-layer workflows, name the workflow and the layers it crosses before
  mixing vocabulary.
- Qualify shared verbs with the owning layer or concrete contract.

### Examples

#### Layer hand-off

Before:

`The field maps to a column.`

After:

`A model field describes stored record data in the ORM layer. When Tango prepares database work, that field becomes a table column in the persistence layer.`

#### Filter boundary

Before:

`The resource filters rows with the query parameters.`

After:

`The resource layer accepts only query parameters defined by the FilterSet. After that public API policy is resolved, Tango turns those values into ORM predicates on the QuerySet.`

---

## Contract-Name Drift

**Detection type:** surface-detectable with contract verification

### What it is

Contract-Name Drift happens when prose uses names that do not match the current
public contract, mixes old and new names for the same abstraction, or introduces
informal aliases where exact naming matters.

This category is about naming accuracy against the verified API.

### Why it harms the reader

Documentation becomes harder to trust when the names in the prose do not line up
with the names in code, exports, or public docs. Even a small naming mismatch can
create search failures and confusion.

### Common patterns

Avoid these patterns:

- using contract names that do not exist in the current public API
- mixing old and new names for the same abstraction
- introducing informal aliases where exact names are important

### Inspection cues

To inspect for this pattern:

1. list all named Tango contracts in the page
2. verify each one against current exports, current code, or current public docs
3. mark any alias, outdated name, or inconsistency
4. rewrite the page to use one verified name consistently

### Borderline valid cases

Informal description is fine when the exact contract name is not important to the
passage. The problem is not plain language. The problem is inaccurate or unstable
naming where exact names matter.

### Rewrite direction

- Verify names against current exports, current code, or current public docs.
- Use one consistent contract name throughout the page.
- Replace informal aliases with the verified public name when contract precision
  matters.

### Example

Before:

`A TestingHarness handles dialect lifecycle behavior.`

After:

`An IntegrationHarness strategy, surfaced through TestHarness, handles dialect lifecycle behavior.`

---

## Overstated Guarantees

**Detection type:** surface-detectable with semantic confirmation

### What it is

Overstated Guarantees are claims whose scope exceeds the verified contract.
These often appear as universal promises, portability claims without caveats, or
language that hides backend differences and capability flags.

This category is about claim scope, not about general optimism or tone.

### Why it harms the reader

It makes documentation misleading in precisely the places where readers rely on
it most: guarantees, limits, and portability expectations.

### Common patterns

Avoid these patterns:

- absolute promises that ignore capability flags or backend differences
- portability claims that imply zero operational tradeoffs
- universal language such as `always`, `never`, or
  `without any additional consideration` when constraints exist

### Inspection cues

Start by quoting sentences containing:

- `always`
- `never`
- `all`
- `only`
- `every`
- `none`
- `without any additional consideration`
- other universal or zero-tradeoff language

Then verify whether the claim is truly unconditional in the current contract.

### Borderline valid cases

Some absolute statements are correct and should remain absolute when the contract
is unconditional.

Example:

`Model hooks run inside Model.objects.`

Do not weaken precise language just because it is absolute. Narrow the claim only
when the contract requires it.

### Rewrite direction

- Verify whether the statement is truly unconditional before rewriting it.
- State the intended behavior and then state the relevant constraints when they
  matter.
- Tie guarantees to supported backends, capabilities, and documented operational
  expectations.

### Examples

#### Overstated guarantee

Before:

`Applications can move between dialects without additional consideration.`

After:

`Most application code remains portable across supported dialects, while migration policy, CI coverage, and capability-sensitive behavior should still be validated per backend.`

#### Valid absolute statement

Valid:

`Model hooks run inside Model.objects.`

---

## Field Dumps and Type Dumps

**Detection type:** surface-detectable

### What it is

Field Dumps and Type Dumps are passages that mirror a config shape, type
definition, or method list into prose without adding behavioral meaning.

This category is about explanation failure at the contract level.

### Why it harms the reader

The reader gets a paraphrase of structure instead of help understanding what
application code must supply, what Tango already does, and where the extension
points are.

### Common patterns

Avoid these patterns:

- listing config fields without explaining the contract
- listing methods without explaining when application code uses them
- rewriting TypeScript types into prose with no extra meaning

### Inspection cues

Quote paragraphs or bullets that:

- enumerate fields or methods in order
- paraphrase a visible type definition
- list options without explaining role, behavior, or extension points

Then ask whether the prose adds meaning beyond the source structure.

### Borderline valid cases

Compact field summaries are fine in reference material when they supplement,
rather than replace, contract-level explanation. A table can be useful if the
surrounding prose explains how the abstraction behaves and when the fields
matter.

### Rewrite direction

- Explain what application code must supply.
- Explain what the abstraction already does.
- Explain the intended extension points.
- Use field lists or tables only as support for a behavioral explanation, not as
  the explanation itself.

### Example

Before:

`Config fields: manager, readSchema, writeSchema, updateSchema, filters, orderingFields, searchFields.`

After:

`Application code supplies the manager and the schemas that define the resource contract. Optional filtering, ordering, and search settings refine the public API.`

---

## Before and After Index

This section collects the common transformation shapes in one place.

### Meta-intro

Before:

`This page explains how filtering works.`

After:

`Filtering lets a resource expose a stable query interface without passing arbitrary query strings into the ORM.`

### Maintainer leakage

Before:

`The class is implemented in packages/resources/src/viewset/ModelViewSet.ts.`

After:

`ModelViewSet is the abstract base class for manager-backed CRUD resources.`

### Scope drift

Before:

`Serializer hooks are still useful when a model hook would be too broad for one endpoint.`

After:

`A common sign that a rule belongs on the model is that it begins in one write path and later needs to be enforced everywhere the record is created or updated.`

### Ungrounded example

Before:

`Suppose posts should receive a slug and timestamps...`

After:

`Suppose your application includes a blog post model. Each blog post should receive a slug and timestamps...`

### Reader-experience break

Before:

`Keep this section of the model responsible for recording those values.`

After:

`Keep this logic in the model hooks so the model records those values whenever the record is created or updated.`

### Layer vocabulary bleed

Before:

`The field maps to a column.`

After:

`A model field describes stored record data in the ORM layer. When Tango prepares database work, that field becomes a table column in the persistence layer.`

Before:

`The resource filters rows with the query parameters.`

After:

`The resource layer accepts only query parameters defined by the FilterSet. After that public API policy is resolved, Tango turns those values into ORM predicates on the QuerySet.`

### Premature term of art

Before:

`ModelViewSet is the usual starting point when one API resource needs both a collection route and a detail route.`

After:

`When one API resource needs both a collection route and a detail route, it is usually easier to keep that HTTP behavior in one class. In Tango, ModelViewSet is the class for that job.`

### Abstract significance marker

Before:

`That separation matters.`

After:

`The manager stays focused on persistence concerns and remains agnostic of routing and other web-layer behavior.`

### Negative-opening contrast

Before:

`It is not an HTTP framework. Tango lives inside Express or Next.js.`

After:

`Tango provides the application-facing layers while Express or Next.js continues to own routing and request lifecycle behavior.`

### Contrastive comma clause

Before:

`These are contract surfaces, not incidental constants.`

After:

`These are contract surfaces and should be treated as deliberate, reviewable parts of Tango's public behavior.`

### Defensive framing

Before:

`Tango runs inside host frameworks such as Express and Next.js. It does not replace them.`

After:

`Tango enhances the frameworks you are already using with application workflows inspired by Django, while continuing to work in tandem with your preferred host framework.`

### Outline-like scaffolding

Before:

`The official docs live here:`

After:

`The official documentation walks through Tango from first principles and is the best place to start when you are evaluating the framework or building with it.`

### Field dump

Before:

`Config fields: manager, readSchema, writeSchema, updateSchema, filters, orderingFields, searchFields.`

After:

`Application code supplies the manager and the schemas that define the resource contract. Optional filtering, ordering, and search settings refine the public API.`

### Contract-name drift

Before:

`A TestingHarness handles dialect lifecycle behavior.`

After:

`An IntegrationHarness strategy, surfaced through TestHarness, handles dialect lifecycle behavior.`

### Overstated guarantee

Before:

`Applications can move between dialects without additional consideration.`

After:

`Most application code remains portable across supported dialects, while migration policy, CI coverage, and capability-sensitive behavior should still be validated per backend.`

### Valid absolute statement

Valid:

`Model hooks run inside Model.objects.`

---

## Summary

This catalog exists to make documentation failures easier to recognize and easier
to correct.

Good Tango prose teaches directly, stays inside scope, respects prerequisite
order, keeps layer boundaries legible, uses verified contract names, scopes
guarantees accurately, and explains behavior instead of paraphrasing structure.
