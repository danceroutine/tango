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

- state the intended behavior and then state the relevant constraints
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
