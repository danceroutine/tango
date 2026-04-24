---
maintainerNote: This page is generated from stable release changesets during Tango stable releases. Do not edit manually.
---

# Changelog

## 1.8.1 - 2026-04-24

Fix scaffolded apps so generated relation registry declarations participate in TypeScript relation-aware query typing by default.

## 1.8.0 - 2026-04-24

Ship Tango's first complete many-to-many workflow across schema, migrations, ORM, resources, and testing.

- Add implicit through-table synthesis and migration support so `t.manyToMany(...)` works without an explicit join model for the common case.
- Add many-to-many related managers, relation-aware filtering, and query support so application code can read and manipulate memberships directly.
- Add DRF-shaped serializer relation fields for many-to-many reads and writes, including primary-key and slug-list workflows.

## 1.7.0 - 2026-04-20

Added Django-style single-record query conveniences across Tango's ORM surface. `Model.objects` now exposes `all()`, `getOrCreate(...)`, and `updateOrCreate(...)`, while `QuerySet` now exposes `all()`, `first()`, `last()`, and strict `get(...)` lookup behavior.

`@danceroutine/tango-core` now exports `MultipleObjectsReturned` so ambiguous single-record lookups can fail with a dedicated error, and `@danceroutine/tango-testing` updates `aManager(...)` so tests can mock the new manager helpers directly.

## 1.6.0 - 2026-04-19

Adds iterable `QueryResult` values from `QuerySet.fetch()`, async iteration over `QuerySet`, and Django-style caching for repeated row-returning evaluation of the same queryset instance. Paginator builders now accept either arrays or `QueryResult` values. The legacy `QueryResult.results` getter remains available for compatibility and now emits a one-time deprecation warning.

## 1.5.0 - 2026-04-17

Tango's relation workflow now extends from first-hop hydration into deeper generated relation-aware contracts. Application code can traverse more of its related graph while keeping ORM results, generated surfaces, and runtime-facing contracts aligned.

- Add generated relation typing and deep relation hydration for nested eager-loading paths.
- Carry the new relation metadata through schema, codegen, OpenAPI, migrations, testing, and Express-facing integration so generated artifacts and runtime behavior agree on the same relation graph.

Previously:

```ts
const recentPosts = await PostModel.objects.query().filter({ published: true }).selectRelated('author').fetch();

const firstPost = recentPosts.results[0];

firstPost.author?.email;
// firstPost.author?.profile is not attached here.
// firstPost.comments is not attached here.
```

Now:

```ts
const recentPosts = await PostModel.objects
    .query()
    .filter({ published: true })
    .selectRelated('author__profile')
    .prefetchRelated('comments__author')
    .fetch();

const firstPost = recentPosts.results[0];

firstPost.author?.profile?.displayName;
firstPost.comments[0]?.author?.email;
// firstPost.author?.profile is attached and typed here.
// firstPost.comments[0]?.author is attached and typed here.
```

## 1.4.0 - 2026-04-09

Tango now provides a first-class ORM transaction boundary for multi-step write workflows. Transaction-aware hooks also receive a narrow post-commit contract so application code can schedule durable side effects without depending on ORM internals.

- Add `transaction.atomic(async (tx) => ...)`, nested savepoints, and `tx.onCommit(...)` for commit-aware application workflows.
- Extend schema write-hook args with an optional transaction callback contract so hooks can register post-commit work without taking a broad ORM dependency.
- Add the testing fixtures and client updates needed to exercise the runtime-backed transaction workflow end to end.

Previously:

```ts
const user = await UserModel.objects.create({
    email: 'author@example.com',
});

await ProfileModel.objects.create({
    userId: user.id,
});

// If a later step throws here, both writes stay committed.
sendWelcomeEmail(user.email);
// This side effect also runs before the workflow is durably complete.
```

Now:

```ts
await transaction.atomic(async (tx) => {
    const user = await UserModel.objects.create({
        email: 'author@example.com',
    });

    await ProfileModel.objects.create({
        userId: user.id,
    });

    // If a later step throws here, both writes roll back together.
    tx.onCommit(() => {
        sendWelcomeEmail(user.email);
    });
    // This side effect runs only after the outer commit succeeds.
});
```

## 1.3.0 - 2026-04-08

Typed relation hydration is now available for Tango querysets. Query code can ask Tango to attach related records directly, while TypeScript keeps the hydrated result shape aligned with the relation metadata authored in the model layer.

- Add `selectRelated(...)` for single-valued relation traversal and `prefetchRelated(...)` for collection-rooted traversal.
- Type relation hydration from model-authored relation metadata, including typed string references through `t.modelRef<TModel>(...)`.
- Update relation-aware query planning and ORM result typing so selected model fields and hydrated relation properties compose correctly.

Previously:

```ts
const recentPosts = await PostModel.objects.query().filter({ published: true }).fetch();

const firstPost = recentPosts.results[0];

// firstPost.author is still the stored reference value here.
// firstPost.author?.email is not available from the queryset result.
```

Now:

```ts
const recentPosts = await PostModel.objects.query().filter({ published: true }).selectRelated('author').fetch();

const firstPost = recentPosts.results[0];

// firstPost.author is now the hydrated user model or null.
firstPost.author?.email;
```

## 1.2.0 - 2026-04-08

The model metadata that relation-aware features build on is now stronger and more consistent. Schema, ORM, migrations, and code generation now share a clearer resolved relation graph and a more fluent scalar metadata authoring shape.

- Add object-form relation decorator configuration, decorator-level relation naming, and resolved relation graph finalization.
- Add the fluent scalar metadata builder form `t.field(...).build()`.
- Update ORM metadata, migrations, testing helpers, and codegen templates to consume the resolved relation graph consistently.

## 1.1.3 - 2026-04-07

- Fix `select()` result typing so projected fields narrow to the database projection rather than the full model shape.

Previously:

```ts
const postCards = await PostModel.objects
    .query()
    .select(['id', 'title'] as const)
    .fetch();

const firstPost = postCards.results[0];

firstPost.id;
firstPost.title;
// firstPost could still be treated like the full model shape here.
// firstPost.slug;
```

Now:

```ts
const postCards = await PostModel.objects
    .query()
    .select(['id', 'title'] as const)
    .fetch();

const firstPost = postCards.results[0];

firstPost.id;
firstPost.title;
// firstPost is narrowed to the selected projection here.
// firstPost.slug; // type error
```

## 1.1.2 - 2026-04-04

- Update package documentation to match the new documentation site URLs.

## 1.1.1 - 2026-04-02

- Update package READMEs to point maintainers to the new contributor documentation.

## 1.1.0 - 2026-04-01

First-class Nuxt support is now available. Tango can live inside Nitro event handlers with an official adapter, generated project scaffolding, and a supported tutorial path that shows how the Tango layers fit into a Nuxt application.

- Add the dedicated `@danceroutine/tango-adapters-nuxt` package.
- Add Nuxt project scaffolding and an official Nuxt blog example.
- Add Nuxt documentation coverage so the adapter, tutorial, and generated project shape describe the same integration model.

## 1.0.2 - 2026-03-31

- Infer typed filter coercion from model metadata so resource query params parse booleans, numbers, and timestamps centrally.
- Derive resource OpenAPI lookup fields from model metadata during schema description.

## 1.0.1 - 2026-03-31

- Hoist shared HTTP method and action-scope value types into adapters core so framework adapters stop re-declaring the same contract.

## 1.0.0 - 2026-03-30

Tango's public packages now reach their first stable `1.0.0` release. This establishes the initial stable contract across the model, ORM, resource, tooling, migration, testing, and adapter layers that now make up the framework's supported package surface.

- Publish Tango's first stable package line across the core framework, tooling, adapters, and supporting packages.
