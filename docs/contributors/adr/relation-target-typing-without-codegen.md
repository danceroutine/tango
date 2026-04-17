# 2026-04-06 Relation Target Typing Without Codegen

> Superseded by [2026-04-09 Deep relation hydration with generated path typing](/contributors/adr/deep-relation-hydration-with-generated-path-typing). This ADR remains as historical context for the earlier one-hop hydration design.

## Problem

Relation hydration needs to preserve Tango's type-safe ORM contract. Runtime hydration alone would let `selectRelated(...)` and `prefetchRelated(...)` attach related records to query results, but application code would still need casts before TypeScript could see those hydrated properties. That would weaken the value of adding hydration in a TypeScript-first ORM.

```ts
const page = await PostModel.objects.query().selectRelated('author').fetch();

// Runtime could attach `author`, but TypeScript would still see only the base post row.
page.results[0].author.email;
```

Forward relations are the easier side of the problem. A model that declares `authorId: t.foreignKey(...)` owns enough schema information for Tango to infer a forward relation such as `Post.author`, provided the decorator carries a typed target model and a stable relation name.

```ts
const PostModel = Model({
    namespace: 'blog',
    name: 'Post',
    schema: z.object({
        authorId: t.foreignKey(() => UserModel, { name: 'author' }),
    }),
});

await PostModel.objects.query().selectRelated('author').fetch();
```

Reverse relations are harder because the relation is authored on the opposite model. `Post.authorId` can produce `User.posts` at runtime through the resolved relation graph, but TypeScript has no automatic way for the `PostModel` declaration to add a new property to the `UserModel` query surface.

```ts
const PostModel = Model({
    namespace: 'blog',
    name: 'Post',
    schema: z.object({
        authorId: t.foreignKey(() => UserModel, { relatedName: 'posts' }),
    }),
});

await UserModel.objects.query().prefetchRelated('posts').fetch();
```

String model keys such as `blog/User` remain useful because they avoid eager runtime imports and reduce circular model import pressure while also being familiar to Django developers. The design question is how far Tango can take relation typing without requiring codegen, while keeping those level of effort and risk low.

```ts
const PostModel = Model({
    namespace: 'blog',
    name: 'Post',
    schema: z.object({
        authorId: t.foreignKey('blog/User', {
            name: 'author',
            relatedName: 'posts',
        }),
    }),
});
```

The design has two constraints.

1. Tango should avoid codegen if the same typing goal can be reached without it, because Django does not need a codegen step and Tango should keep the server bootstrap path low-friction.
2. Tango should also minimize manual type declarations and toil from application developers, so relation hydration behaves as close to "just works" as TypeScript allows.

### Considered Option: Typed String References

Keep string model keys for runtime resolution and add a type-only target channel for cases where a developer wants strict relation typing without importing the target model value at runtime.

The intended shape is a typed string-reference form for decorators and target-generic relation hydration for reverse edges:

```ts
// in lib/PostModel.ts
const PostModel = Model({
    schema: z.object({
        authorId: t.foreignKey<typeof import('./UserModel').UserModel>('blog/User', {
            name: 'author',
            relatedName: 'posts',
        }),
    }),
});

// in app/viewsets/PostViewSet.ts
await PostModel.objects.query().selectRelated('author').fetch();
await UserModel.objects.query().prefetchRelated<typeof PostModel>('posts').fetch();
```

Forward relations can use the source model's own schema metadata. Reverse relations use the generic target model to let TypeScript inspect whether that target model points back to the source model with the requested `relatedName`.

#### Pros

- Keeps string keys as the runtime decoupling mechanism for cyclic model graphs.
- Gives TypeScript a target model type without forcing an eager runtime import.
- Preserves synchronous relation graph finalization and synchronous `Model.objects.meta` access.
- Lets forward relations work without extra call-site annotations when the decorator target is type-visible.
- Gives reverse relations a strict call-site form without requiring codegen.

#### Cons

- Reverse relation calls need a target model generic unless a later generated or ambient registry supplies that association.
- Plain string keys without a type parameter remain runtime-safe but weaker for static relation typing.
- The API introduces a mandatory generic syntax for users who need strict reverse relation typing, requiring a higher degree of familiarity with TypeScript's type system.

### Considered Option: Async Model Reference Callbacks

Allow relation decorators to accept callbacks that return a promise, so model declarations can use dynamic imports instead of string keys:

```ts
const PostModel = Model({
    schema: z.object({
        authorId: t.foreignKey(async () => (await import('./UserModel')).UserModel, {
            name: 'author',
            relatedName: 'posts',
        }),
    }),
});
```

This preserves target model typing while avoiding eager runtime cyclical imports.

#### Pros

- Keeps the relation target as an actual model value from TypeScript's point of view.
- Lets developers use `await import(...)` to break runtime import cycles.
- Aligns with projected future async model-loading needs such as data migration workflows.

#### Cons

- Makes relation target resolution asynchronous.
- Requires a larger design for async registry finalization, async-aware query metadata, and tooling that currently expects synchronous model metadata.
- A proxy-backed `Model.objects` could hide async work for promise-returning methods, but synchronous surfaces such as `Model.objects.meta` would still need a policy.
- Introduces a broad runtime initialization concern before relation hydration needs it.

### Considered Option: Ambient Relation Registry

Define an empty global relation registry that application code or generated files can augment:

```ts
declare global {
    interface TangoRelationRegistry {
        'blog/User': {
            posts: { kind: 'hasMany'; target: typeof PostModel };
        };
    }
}
```

`QuerySet` could use that registry to validate relation names and shape hydrated result rows.

#### Pros

- Supports strict forward and reverse relation typing when the registry is present.
- Creates a natural target for future codegen output.
- Avoids async registry finalization and keeps runtime model resolution unchanged.

#### Cons

- Manual registry entries can drift from runtime model declarations.
- The registry duplicates relation facts that already exist in model declarations.
- The user experience depends on either disciplined manual declaration or a future codegen workflow.

### Considered Option: Generated Relation Registry

Generate the ambient relation registry from model declarations or a model manifest, then let application code consume strict relation typing without hand-written declarations.

#### Pros

- Gives the strongest developer experience for reverse relation typing.
- Can make string-key model references strongly typed without per-call generics.
- Centralizes the duplicated relation type information in generated output rather than hand-written application code.

#### Cons

- Requires a codegen workflow that can see the application's model graph.
- Adds build-step expectations before relation hydration itself is proven.
- Needs careful integration with examples, framework scaffolds, and migration workflows.

### Decision: Typed String References

Tango will pursue typed string references as the next non-codegen bridge for relation hydration typing. Runtime model resolution should continue using stable string keys, direct model refs, or synchronous callbacks. Type-level relation inference should use typed target information where it is available.

Forward relations should infer from the source model's own decorated schema when the target model type is visible. Reverse relations should support an explicit target-model generic at the hydration call site, such as `prefetchRelated<typeof PostModel>('posts')`, so TypeScript can validate that the target model points back to the source model with the requested relation name.

Async model reference callbacks and generated relation registries remain valid future directions. They should be designed as separate changes because they affect model loading, registry finalization, and tooling workflows beyond relation hydration call-site typing.

#### Known Consequences

- `selectRelated(...)` and `prefetchRelated(...)` can become strictly typed without requiring codegen for the first implementation pass.
- Reverse relation typing will require an explicit target model generic until Tango adds an ambient or generated relation registry.
- String model keys remain part of the supported runtime contract because they solve cyclic import pressure.
- Async model callbacks remain deferred, even though future data migration workflows may eventually need an async model-loading story.
- Runtime relation validation remains authoritative. Type-level target hints guide the compiler, and runtime validation still decides whether a relation can hydrate successfully.
