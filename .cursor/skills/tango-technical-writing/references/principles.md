# Principles

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

### Contributor docs

Optimize for:

- architectural intent mapped to concrete maintainer responsibilities
- maintenance workflow
- release workflow
- repository structure when it matters
- repository locations only when they reduce maintainer ambiguity
- implementation constraints
- codebase-wide consistency

### Package READMEs

Treat each README as:

- an NPM landing page
- a mini-documentation page
- a funnel into the official docs

The opening should explain what the package is and why its boundary exists in the same section.

### Docstrings

Docstrings should:

- explain behavior
- explain intended use
- explain boundaries when needed
- stay short enough for IDE popups
- avoid restating TypeScript types

## Core Rules

- Start from the concept, task, or contract itself.
- Write for the reader's job, not for the author's familiarity with the repo.
- Build a prerequisite roadmap before drafting, and use it to govern first mentions and section order.
- Order sections around the reader's likely questions.
- Keep one page about one task, concept, or contract.
- Prefer public behavior over implementation detail.
- Prefer explanation over rhetorical emphasis.
- Prefer affirmative framing over defensive framing.
- Prefer explicit reasoning over abstract importance markers.
- Prefer connected explanatory prose over clipped outline syntax when the material is not inherently list-shaped.
- Prefer explicit transitions before and after code blocks so the reader knows why the snippet matters.
- Ground example domains immediately before relying on example nouns.
- Test the draft against a reader who has not seen the surrounding conversation, code review, or design discussion.
- Avoid mirroring type definitions or field shapes into prose unless the type alone is not enough to explain the contract.
- Use current exported contract names consistently.
- Scope claims to supported behavior and capability constraints when those constraints are relevant. Use direct absolute language when the contract really is unconditional.
- **CRITICAL** Documentation should be timeless. They should describe how things are now, without considering for how things used to be.

## Django-Derived Structural Habits

- Introduce the subject in plain terms before comparing it to adjacent abstractions.
- Introduce the concept before introducing the framework term of art that names it, unless that term is already part of the reader's assumed knowledge.
- Let each section answer the next question a careful reader is likely to have.
- Keep explanations steady and connective instead of collapsing into terse command commentary after a strong opening.
- Use examples that are concrete enough to be memorable and explicit enough to be understood immediately.
- Surround commands and code with orienting prose so the reader knows what the snippet is for and what to notice in it.
- Read the page as though you do not already know where it is going. Rewrite any passage that only makes sense after scanning ahead.
- Treat the roadmap like a topological sort for reader understanding, not like an outline to perfect indefinitely.
- Defer adjacent topics to their own how-to or topic guide unless the current task truly requires them.

## Document-Type Rules

### Tutorials

- Teach by building something concrete.
- Move in the same order a developer would build the thing.
- Keep the reader oriented around what they are trying to achieve.

### Topic guides

- Explain boundaries, roles, and mental models.
- Clarify which layer owns which responsibility.

### How-to guides

- Solve one task directly.
- Keep theory subordinate to the task.
- Introduce supporting abstractions only when the task has reached the point where the reader needs them.
- Keep adjacent abstractions out of the page unless they are necessary to complete the task.
- Introduce example domains explicitly before code snippets rely on them.
- Make the procedural order match the order a developer would actually do the work.

### Reference pages

- Describe the public contract.
- Focus on what the abstraction is for, what application code supplies, and what the abstraction guarantees.
- Do not become an export dump or a field dump.

## Default Rewrite Direction

When a sentence feels wrong, move it in this direction:

- from meta-commentary to direct explanation
- from repository detail to public contract in end-user docs, READMEs, and docstrings
- from slogan-like emphasis to explicit reasoning
- from defensive negation to affirmative role language
- from outline-like scaffolding to continuous explanatory prose
- from field dump to role and behavior
- from maintainer voice to reader-task voice
