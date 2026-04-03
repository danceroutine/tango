# Anti-Patterns

## AI-Style Rhetoric

Avoid these patterns:

- negative-opening sentences such as `It is not X`
- contrast formulas such as `It's not X, it's Y`
- contrastive comma clauses such as `X, not Y`
- defensive framing such as `It does not replace them`
- short emphatic fragments such as `That matters.`
- clipped underdeveloped sentences that sound like rhetorical beats instead of explanation
- rhetorical self-labeling such as `Honest version`, `The brutal truth`, `Frankly`
- meta-intros such as `This page...`, `This guide...`, `This section...`
- summary scaffolding such as `X is summarized here` or `Y is described here`
- label-and-colon scaffolding such as `The official docs live here:` when a full sentence would teach more clearly

### Rewrite Direction

- Start with the claim itself.
- Put the reasoning in the same sentence or the next sentence.
- Remove tone-signaling phrases that only announce posture.
- State the role the thing does play instead of defining it by what it does not do.
- Replace outline-like fragments with complete explanatory sentences when the content is not naturally a list.

## Maintainer Leakage in End-User Docs

Avoid these patterns in end-user docs:

- `implemented in packages/...`
- `the authoritative source is ...`
- export-barrel narration
- repository-tour explanations
- source-location narration when the reader is trying to build something

Contributor docs may include repository locations when that detail directly helps maintainers implement, test, or review a change.

### Rewrite Direction

- replace file-location language with role language
- explain what the abstraction does, when to use it, and how it fits into the workflow

## Scope Drift and Sequencing Failures

Avoid these patterns:

- answering a question the reader is not asking yet
- introducing adjacent abstractions before the page has explained its named subject
- letting a page about one abstraction drift into a different abstraction
- non-sequitur comparison paragraphs that interrupt the main task
- unexplained example nouns such as `Post` when the reader has not yet been told what the example domain is
- strong opening prose followed by abrupt, under-explained command or code sections

### Rewrite Direction

- derive section order from the reader's likely questions
- keep one page about one task, concept, or contract
- ground example domains immediately
- explain why the next code block or command matters before presenting it
- move adjacent abstractions to their own page unless the current task depends on them

## Reader-Experience Breaks

Avoid these patterns:

- using a term that only makes sense if the reader already knows the surrounding conversation
- introducing a framework term of art before the underlying concept has been socialized
- requiring the reader to scan ahead to infer what a noun or phrase means
- giving an instruction before explaining why the reader should care about it
- using vague internal shorthand such as `this section of the model` when the concrete construct has not been named
- using abstract phrases such as `lifecycle rule` or `write paths` without grounding them in the current example

### Rewrite Direction

- read the draft linearly as the target audience
- ask what the reader is likely wondering after each paragraph
- introduce the concept first, then the local framework name for that concept
- replace vague shorthand with the concrete construct the reader can see in code
- add the missing rationale before the instruction when the page currently jumps straight to the action
- rewrite any sentence that depends on scan-ahead for comprehension

## Contract-Name Drift

Avoid these patterns:

- using contract names that do not exist in the current public API
- mixing old and new names for the same abstraction
- introducing informal aliases where exact names are important

### Rewrite Direction

- verify names against current exports and public docs
- use one consistent contract name throughout the page

## Overstated Guarantees

Avoid these patterns:

- absolute promises that ignore capability flags or backend differences
- portability claims that imply zero operational tradeoffs
- universal language such as `always`, `never`, or `without any additional consideration` when constraints exist

### Rewrite Direction

- verify whether the statement is truly unconditional before rewriting it
- state the intended behavior and then state the relevant constraints when they matter
- tie guarantees to supported backends, capabilities, and documented operational expectations

## Field Dumps and Type Dumps

Avoid these patterns:

- listing config fields without explaining the contract
- listing methods without explaining when application code uses them
- rewriting TypeScript types into prose with no extra meaning

### Rewrite Direction

- explain what application code must supply
- explain what the abstraction already does
- explain the intended extension points

## Before and After

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

`Serializer hooks are still useful...`

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
