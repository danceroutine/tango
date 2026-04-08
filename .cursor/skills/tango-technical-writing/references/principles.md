# Principles

## Purpose

These principles define what good Tango documentation should optimize for.

They describe the qualities the prose should have when it is finished. They do not define the review workflow, audit mechanics, or observability protocol used to get there.

When these principles compete, prioritize them in this order:

1. contract accuracy
2. reader comprehension
3. scope discipline
4. stylistic elegance

Documentation should describe how Tango works now. Avoid narrating historical evolution, deprecated reasoning, or the path the codebase took to get here unless the document is explicitly about migration or historical context.

## Audience Split

### End-user docs

Optimize for:

- usage
- concepts
- workflows
- public contracts
- decisions an application developer needs to make

Do not optimize for:

- source locations
- package barrel structure
- repository navigation
- implementation-tour narration

End-user docs should help an application developer build, configure, or decide. They should not read like a guided walk through the repository.

### Contributor docs

Optimize for:

- architectural intent mapped to concrete maintainer responsibilities
- maintenance workflow
- release workflow
- implementation constraints
- repository structure when it materially reduces maintainer ambiguity
- repository locations only when they directly help implementation, testing, or review

Contributor docs may include source locations and codebase structure, but only when that detail helps someone maintain the system correctly.

### Package READMEs

Treat each README as:

- an npm landing page
- a mini-documentation page
- a funnel into the official docs

The opening should explain what the package is and why its boundary exists in the same section. A reader should be able to understand the package's job before learning its internal vocabulary.

### Docstrings

Docstrings should:

- explain behavior
- explain intended use
- explain boundaries when they matter
- stay short enough for IDE popups
- avoid restating TypeScript types

A good docstring survives implementation churn because it explains the contract and purpose, not incidental mechanics.

## Core Principles

### Start from the reader's job

Start from the concept, task, or contract the reader cares about.

Write for the reader's job, not for the author's familiarity with the repository. A page should help the reader do something, understand something, or evaluate a decision. Repository knowledge should support that goal rather than become the goal.

### Establish prerequisites before dependents

Build the explanation in prerequisite order.

Introduce the concept before the Tango term of art that names it unless that term is already part of the reader's assumed knowledge. A first mention should make sense at the moment it appears, without requiring the reader to scan ahead.

### Let section order follow likely questions

Organize the page around the questions a careful reader is likely to ask next.

Keep adjacent or more advanced questions behind the named subject until the page has established enough context. A strong document feels linear because each section arrives when the reader is ready for it.

### Keep one page about one subject

Keep one page about one task, concept, or contract.

Adjacent abstractions should only appear when the current subject depends on them. If a topic deserves its own mental model, it usually deserves its own page.

### Prefer public behavior over implementation detail

Describe what application code supplies, what Tango does with it, and what behavior the reader should expect.

Prefer implementation detail only when the document is for contributors or when that detail is required to explain a contract boundary. End-user documentation should center public behavior, not source structure.

When implementation details are necessary, prefer a lower degree of granularity and rely more on conceptual organization. E.g. instead of "`QueryCompiler` accepts a `QuerySetState` which it parses and returns `CompiledSql`" prefer `The query compiler accepts a pre-flight composition of the intended query, before validating and compiling it"

### Prefer explanation over rhetorical emphasis

Teach by stating the claim directly and then explaining why it is true or why it matters.

Avoid slogan-like emphasis, posture-signaling phrases, abstract significance markers, and clipped rhetorical beats. The prose should carry meaning through explanation, not through tone.

### Prefer affirmative role language

Describe the role the abstraction does play.

Define an abstraction by its positive responsibility when that would teach more clearly than contrast. Negation is acceptable when it is required for technical precision, but affirmative explanation should carry most of the teaching load.

### Prefer connected prose over outline shorthand

Use complete explanatory sentences when the material is not inherently list-shaped.

Lists, tables, and bullets are useful when the structure itself teaches something. Otherwise, connected prose usually teaches relationships, sequencing, and boundaries more clearly than outline-like shorthand.

### Explain why code and commands matter

Surround commands and code with orienting prose.

Before a snippet appears, the reader should know what problem it solves or what behavior it demonstrates. After it appears, the reader should know what to notice. Strong documentation does not drop code blocks into the page as unexplained artifacts.

### Ground examples before using them

Introduce the example domain before relying on example nouns.

If the page uses terms such as `Post`, `Comment`, `User`, or `Order`, the reader should know what those nouns represent in the example before the prose starts building new abstractions on top of them.

### Use current contract names

Use current exported contract names consistently.

Keep one current name for each abstraction. Avoid old names, mixed names, and informal aliases when exact naming is important to application code or to maintainer reasoning.

### Scope guarantees correctly

State the intended behavior precisely and scope it to supported behavior and capability constraints when those constraints matter.

Use direct absolute language when the contract is truly unconditional. Narrow the claim when supported backends, flags, or operational constraints change the behavior.

### Keep documentation timeless

Documentation should read as a description of the current system.

Avoid phrasing that depends on old design debates, obsolete architecture, or transitional history unless the document's job is to explain a migration path or a deliberate historical distinction.

## Layer Language Discipline

Tango's default vertical architecture is:

1. Host Framework
2. Adapter Layer
3. Resource Layer
4. ORM Layer
5. Persistence Layer

Use the page's primary layer to choose its default nouns and verbs. When a page needs vocabulary from another layer, transition the reader before crossing that boundary. A good hand-off names the current layer's concern, explains why another layer now matters, and then introduces the target layer's vocabulary.

### Layer Vocabulary

| Layer             | Nouns                                                                                                                                                                           | Verbs                                                                                                     | Boundary                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Host Framework    | Express, Next.js, Nuxt, route, middleware, request lifecycle, route handler, framework request, framework response, app startup                                                 | route, mount, bootstrap, invoke, pass the request                                                         | The host framework owns routing, middleware order, deployment shape, and the larger request lifecycle.            |
| Adapter Layer     | adapter, `RequestContext`, `TangoRequest`, `TangoResponse`, route params, query params, normalized request, handler registration                                                | adapt, translate, normalize, register, dispatch to a resource                                             | The adapter translates between the host framework contract and Tango's framework-neutral resource contract.       |
| Resource Layer    | resource, `APIView`, `GenericAPIView`, `ModelViewSet`, serializer, request payload, response representation, `FilterSet`, search, ordering, paginator, HTTP operation, endpoint | validate input, serialize output, represent, expose, dispatch, filter as public API policy, paginate      | The resource layer defines the client-facing HTTP contract. Serializers live in this layer.                       |
| ORM Layer         | model, schema, field, record, relation, manager, `Model.objects`, `QuerySet`, predicate, relation hydration, model hook                                                         | query, fetch, create, update, delete, hydrate, attach a manager, resolve a relation, apply a model hook   | The ORM layer defines stored-record contracts and model-backed data access. Models and schema live in this layer. |
| Persistence Layer | database, dialect, SQL, table, row, column, index, constraint, DB client, transaction, schema introspection, backend capability                                                 | connect, compile SQL, execute SQL, introspect, apply migrations, enforce constraints, start a transaction | The persistence layer owns database behavior, dialect behavior, and backend-specific semantics.                   |

### Cross-Layer Hand-Offs

Keep another layer's nouns and verbs from becoming casual synonyms.

In an ORM-layer page, `model`, `record`, and `field` are the default terms. `table`, `row`, and `column` belong to the Persistence Layer and need a hand-off before they appear. The hand-off should explain why the discussion is moving from stored-record contracts to database representation.

A good hand-off names both layers:

`A model field describes stored record data in the ORM layer. When Tango prepares database work, that field becomes a table column in the persistence layer.`

The same discipline applies to shared terms. A filter in the Resource Layer is public query-parameter policy. A filter in the ORM Layer is a queryset predicate. When prose crosses that boundary, the transition should explain the conversion rather than letting the terms blur together.

A good hand-off explains the conversion:

`The resource layer accepts only query parameters defined by the FilterSet. After that public API policy is resolved, Tango turns those values into ORM predicates on the QuerySet.`

### Cross-Layer Workflows

Some topics are workflows rather than single-layer topics. In those cases, name the workflow and the layers it crosses before mixing vocabulary.

Examples:

- Migrations move from ORM-layer model metadata into Persistence Layer tables, columns, constraints, SQL compilation, and journaled execution.
- OpenAPI generation projects Resource Layer contracts and ORM-layer model metadata into an external API document.
- CLI and codegen workflows often touch several layers and should name the target layer before relying on its terms.
- Testing workflows should name the boundary they exercise, whether that is Resource Layer behavior, ORM behavior, Persistence Layer behavior, or full host-framework behavior.

## Structural Habits

### Introduce the subject in plain terms first

Before comparing an abstraction to adjacent concepts, describe its job directly in language the target audience can understand. The reader should know what the thing is for before the prose starts drawing boundaries around it.

### Let each section answer the next question

A careful reader should feel that each section arrives at the moment it becomes necessary. Good sequencing reduces confusion because it removes the need to mentally hold unexplained terms in suspension.

### Keep explanations steady and connective

Do not open with strong conceptual prose and then collapse into terse command commentary or unexplained code. The explanatory tone should remain consistent across the page so the reader is never dropped from understanding into transcription.

### Use concrete, immediately intelligible examples

Examples should be memorable without becoming cute, and concrete without becoming overloaded. The reader should understand what the example domain is doing before the example starts teaching Tango-specific concepts.

### Read as a fresh reader would

A passage is weak if it only makes sense because the writer already knows where the page is going. Good documentation can be read linearly by someone who has not seen the surrounding code review, design discussion, or implementation history.

## Document-Type Guidance

### Tutorials

Teach by building something concrete.

Move in the same order a developer would build the thing, and keep the reader oriented around what they are trying to achieve at each step. The tutorial's structure should mirror the real construction order, not the author's preferred conceptual order when those differ.

### Topic guides

Explain boundaries, roles, and mental models.

A topic guide should help the reader understand where a concept lives, what responsibility it owns, and how it relates to nearby abstractions without drifting into a procedural walkthrough unless the mental model depends on one.

### How-to guides

Solve one task directly.

Keep theory subordinate to the task. Introduce supporting abstractions only when the task has reached the point where the reader needs them. Keep adjacent abstractions out of the page unless they are necessary to complete the task. The procedural order should match the order a developer would perform the work.

### Reference pages

Describe the public contract.

Focus on what the abstraction is for, what application code supplies, and what the abstraction guarantees. A reference page should not collapse into an export dump, a field dump, or a type signature paraphrase.

## Default Rewrite Direction

When a sentence or section feels wrong, move it in this direction:

- from meta-commentary to direct explanation
- from repository detail to public contract in end-user docs, READMEs, and docstrings
- from slogan-like emphasis to explicit reasoning
- from defensive negation to affirmative role language
- from outline-like scaffolding to continuous explanatory prose
- from field dump to role and behavior
- from maintainer voice to reader-task voice

## Summary

Good Tango documentation is contract-accurate, linear, scoped, audience-aware, and written from the reader's job outward.

It introduces concepts before jargon, keeps pages centered on one subject, crosses layer boundaries deliberately, grounds examples before using them, and explains behavior in connected prose that a fresh reader can follow without hidden context.
