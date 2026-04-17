# 2026-04-09 Deep Relation Hydration With Generated Path Typing

> This ADR supersedes [2026-04-06 Relation target typing without codegen](/contributors/adr/relation-target-typing-without-codegen).

## Problem

Tango's original relation hydration contract stopped at one hop. `selectRelated('author')` and `prefetchRelated<typeof PostModel>('posts')` were useful, but they left four related gaps once application code needed real graph traversal.

1. Nested paths such as `author__profile` and `posts__comments__author` had no runtime planning model.
2. Cross-API overlap such as `selectRelated('author')` plus `prefetchRelated('author__posts')` had no canonical execution boundary.
3. Reverse and nested path typing still depended on explicit target-model generics in common cases.
4. The type story and runtime story were drifting apart because runtime truth lived in the resolved relation graph while richer type information would have required a second source of truth.

Those gaps were closely related. Shipping only one piece first would have created partial abstractions without a coherent developer story.

## Considered Option: Extend the Existing One-Hop QuerySet State

Keep `selectRelated(...)` and `prefetchRelated(...)` as flat string arrays on `QuerySetState`, then bolt nested parsing and recursive execution onto `QueryCompiler` and `QuerySet`.

### Pros

- Lowest immediate implementation churn.
- Preserves the existing one-hop internal shape.

### Cons

- Flat state is the wrong abstraction for nested shared-prefix traversal.
- Planning, validation, and execution logic would spill across `QuerySet`, `QueryCompiler`, and executor code.
- Cross-API overlap would still lack a single normalized owner.
- The result would be harder to extend for projection or many-to-many hydration later.

## Considered Option: Runtime Nested Hydration Without Generated Typing

Add nested traversal at runtime, but keep the type system on explicit target-model generics and local schema inference only.

### Pros

- Smaller tooling surface.
- Avoids introducing generated artifacts before the runtime is proven.

### Cons

- Reverse and multi-hop relation typing would remain weak in the common case.
- Runtime and compile-time relation capabilities would keep diverging.
- Application code would still pay ongoing generic overhead for nested reverse traversal.

## Considered Option: Generated Typing Without Runtime Drift Checks

Generate a global relation registry from model declarations and let the ORM type system consume it, but rely only on generation and CI discipline to keep it aligned with runtime.

### Pros

- Stronger type experience than explicit generics alone.
- Simpler runtime implementation than a drift-aware model.

### Cons

- Generated typing could silently drift from the finalized resolved relation graph that runtime actually uses.
- Developers would have no local feedback when they forget to refresh generated artifacts.
- The generated registry would feel like a second authority instead of a projection of runtime truth.

## Decision: Ship Deep Relation Hydration As One Integrated Runtime-And-Typing Feature

Tango will ship deep relation hydration as one coordinated feature with three layers:

1. a shared-prefix traversal planner for runtime hydration
2. a compiled recursive execution contract for joins and batched prefetch work
3. a generated app-local ambient relation registry derived from the finalized resolved relation graph

### Planning and execution

- Public API stays Django-shaped: `selectRelated(...paths)` and `prefetchRelated(...paths)` still own eager loading.
- Both APIs use the same `__` path language.
- `selectRelated(...)` remains single-valued join traversal.
- `prefetchRelated(...)` remains collection-rooted or mixed traversal.
- Requested paths are normalized into a shared-prefix traversal intermediate representation (IR) rather than left as flat strings.
- Planning is split into explicit phases:
    1. path parsing
    2. path validation against the finalized resolved relation graph
    3. path normalization into a shared-prefix traversal intermediate representation
    4. hydration planning into executable join and prefetch plans
- Execution coordination is separate from planning.

### Canonical entity identity

- Within one query execution, hydrated entities are canonicalized by `(model identity, primary key value)`.
- Mixed join and prefetch traversal must never create competing in-memory copies of the same row in the same execution scope.
- Attachment-site maps point to canonical entity instances.
- Descendant hydration attaches to canonical instances rather than path-local copies.

### Relation legality

- Path legality is derived from resolved relation capabilities plus cardinality transitions, not cardinality alone.
- This keeps unsupported capabilities such as many-to-many hydration out of the contract without pretending they are ordinary `many` edges.

### Recursive execution contract

- The planner emits a recursive hydration plan rooted at the base model.
- Each node records the owner model, relation edge, target model, load mode, cardinality, children, and provenance.
- The compiler consumes that plan and emits a compiled recursive execution contract:
    - root SQL plan for the base queryset
    - join hydration descriptors
    - recursive prefetch descriptors
    - explicit alias and hydration-column bookkeeping
- The executor consumes only that compiled recursive execution contract.

### Scalar queries

- `count()` and `exists()` strip eager-loading directives before validation and compilation.
- Eager-loading directives are fetch-shape concerns only.
- This keeps immutable queryset snapshots practical for patterns such as:

```ts
const dataQS = qs.selectRelated('author__profile').prefetchRelated('comments__author');

if (await dataQS.exists()) {
    return dataQS.fetch();
}
```

### Generated relation typing

- The generated relation registry is derived from the same finalized resolved relation graph that runtime uses.
- Tango generates an app-local registry because relation typing is scoped to one concrete application's exported model module, one registry snapshot, and one TypeScript program. A global shared registry would blur application boundaries and make collisions between unrelated model graphs harder to reason about.
- `tango codegen relations` is the direct generation command.
- `tango make:migrations` invokes relation generation as the normal ergonomic trigger to provide a single familiar workflow for most schema changes, but it is not the source of truth.
- Generated artifacts are app-local and include both:
    - an ambient `.d.ts` file for typing
    - a metadata file with a canonical relation-graph fingerprint

### Drift detection

- Runtime resolved relation metadata remains authoritative for execution.
- Generated typing is the supported compile-time artifact.
- CI and typecheck stale-artifact checks are the hard enforcement path.
- Runtime drift warnings in `development` and `test` are additive only.
- Missing generated artifacts do not warn by default. Warnings apply only when generated relation typing is configured or expected in that app context.
- The fingerprint exists to answer one narrow question: "does the generated registry describe the same finalized relation graph snapshot that runtime is using?" Tango compares the generated fingerprint to the live fingerprint during startup checks so stale generated typing can be detected without treating generated files as runtime authority.

### Cycles

- Runtime supports finite explicit cyclic paths.
- Cycles are validated path-by-path against the resolved relation graph instead of being rejected categorically.
- Generated cyclic path unions are bounded by an internal default horizon of `4` traversed edges.
- That horizon is a type-generation guard, not a public API contract.
- The bounded horizon exists because unbounded cyclic unions create disproportionate TypeScript recursion cost, union growth, and editor latency. The goal is to keep common recursive paths strongly typed without turning recursive model graphs into a type-system performance problem.
- Paths beyond the generated cyclic horizon fall back to weaker typing instead of becoming runtime-invalid.

### Scope cuts

- This milestone hydrates full related rows only.
- It does not add public related-row projection syntax.
- It does not add many-to-many hydration.
- It does not add separate `selectDeeplyRelated(...)` or `prefetchDeeplyRelated(...)` APIs.

## Consequences

- Tango now has one coherent runtime and typing story for nested eager loading.
- The planner/compiler/executor boundary is more explicit and easier to extend.
- Reverse relation calls no longer need explicit target-model generics in the common generated-registry case.
- Explicit target-model generics remain a supported fallback when generated typing is absent, stale, or intentionally out of scope.
- The framework now owns a generated artifact workflow for relation typing, which increases tooling scope but reduces long-term type/runtime drift.
- Deep cyclic traversal remains available at runtime, but the type system intentionally stops short of modeling unbounded recursive path languages.
