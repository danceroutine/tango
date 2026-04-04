# ORM query API

`@danceroutine/tango-orm` provides the query and write surface behind `Model.objects`.

Application code usually meets this package in two places. `Model.objects` is the per-model entrypoint for lookups and writes. `QuerySet<T>` is the immutable query builder returned by `Model.objects.query()`. After those core surfaces, this page covers the lower-level exports that startup code, tests, and tooling may use directly.

## `Model.objects` and `ModelManager<T>`

Every Tango model receives an `objects` property once the ORM runtime is initialized. The first time application code reads `PostModel.objects`, Tango creates a `ModelManager<Post>` for the active runtime and caches it for that model and runtime.

`ModelManager<T>` is the model-specific entrypoint for one table. It is where application code starts new queries, looks up rows by primary key, and performs writes through Tango's normal ORM contract.

The core lookup methods are:

- `query()`
- `findById(id)`
- `getOrThrow(id)`

`query()` starts a new `QuerySet<T>`. `findById(id)` returns one row or `null`. `getOrThrow(id)` returns one row or throws `NotFoundError` when the row does not exist.

The core write methods are:

- `create(input)`
- `update(id, patch)`
- `delete(id)`
- `bulkCreate(inputs)`

These methods are the standard write path through the ORM. Model-owned write hooks run here, so create, update, delete, and bulk insert behavior that belongs to the model stays attached to the same contract.

```ts
const draft = await PostModel.objects.create({
    title: 'First post',
    slug: 'first-post',
    published: false,
});

const samePost = await PostModel.objects.findById(draft.id);

const published = await PostModel.objects.update(draft.id, {
    published: true,
});
```

## `QuerySet<T>`

`QuerySet<T>` represents a database query against one model. Each refinement returns a new queryset, leaving the earlier one unchanged. The query only runs when application code calls an execution method such as `fetch(...)`, `fetchOne(...)`, `count()`, or `exists()`.

### Refining the query

Use `filter(q)` and `exclude(q)` to describe which rows belong in the result set. `filter(...)` adds normal conditions. `exclude(...)` adds negated conditions.

Use `orderBy(...tokens)`, `limit(n)`, and `offset(n)` to control result ordering and result size. Ordering tokens follow the usual Django pattern, such as `'title'` for ascending order or `'-createdAt'` for descending order.

Use `select(cols)` when the SQL query should only project a subset of columns.

Use `selectRelated(...rels)` when declared relation metadata should change the SQL query itself. It tells the ORM to plan joins for the named relations.

Use `prefetchRelated(...rels)` when the query should record relation names for prefetch behavior outside the core SQL join path. The exact behavior there depends on the active adapter and caller.

```ts
const recentPublishedPosts = PostModel.objects
    .query()
    .filter({ published: true })
    .exclude({ slug__icontains: 'draft' })
    .orderBy('-createdAt')
    .limit(10);
```

### Executing the query

Use `fetch(shape?)` when application code wants the full result set for the current query. It returns a `QueryResult<Out>` object with `results` and `nextCursor`.

At the queryset level, `nextCursor` is currently `null`. Cursor pagination belongs to resource paginators rather than the queryset contract itself.

Use `fetchOne(shape?)` when application code only needs the first row that matches the current query. It applies `limit(1)` internally and returns that row or `null`.

Use `count()` when application code needs the number of matching rows rather than the rows themselves.

Use `exists()` when application code only needs to know whether at least one row matches.

```ts
const page = await PostModel.objects
    .query()
    .filter({ published: true })
    .orderBy('-createdAt')
    .fetch();

const first = await PostModel.objects.query().orderBy('title').fetchOne();
const total = await PostModel.objects.query().filter({ published: true }).count();
const hasDrafts = await PostModel.objects.query().filter({ published: false }).exists();
```

### Shaping results and current limits

`fetch(...)` and `fetchOne(...)` accept an optional shaping function or parser when application code wants a result shape that differs from the full model row.

```ts
const titles = await PostModel.objects
    .query()
    .filter({ published: true })
    .fetch((row) => row.title);
```

This is the main way to make a narrower result shape explicit in application code today.

`select(...)` and `fetch(shape?)` solve related but different problems.

`select(...)` works at the database-query level. It changes which columns the SQL query asks the database to return. Use it when the database should only send a smaller projection in the first place.

`fetch(shape?)` works at the TypeScript application-code level. It takes whatever row shape the query returned and turns it into the shape the caller wants to work with. Use it when the calling code should receive a narrower or transformed result type.

In practice, use `select(...)` to reduce the SQL projection, and use `fetch(shape?)` when the calling code should see an explicit transformed result. It is common to use both together when you want a smaller database query and a narrower application-facing type in the same workflow.

`select(...)` does not yet narrow the TypeScript result type by itself.

`selectRelated(...)` affects join planning, but it does not yet hydrate nested related model objects onto each returned row.

`prefetchRelated(...)` is part of the public query contract, but the exact prefetch behavior depends on the active adapter.

## `Q`

`Q` is the boolean-expression builder for nested query logic. Reach for it when one plain filter object is no longer enough to express the condition clearly.

The package also exports `QBuilder` directly for code that needs the concrete builder class, but most application code uses the shorter `Q` entrypoint.

The main helpers are:

- `Q.and(...)`
- `Q.or(...)`
- `Q.not(...)`

```ts
const visiblePosts = await PostModel.objects
    .query()
    .filter(
        Q.and(
            { published: true },
            Q.or({ featured: true }, { visibility: 'public' })
        )
    )
    .fetch();
```

## Adapter and connection exports

Most applications reach the database through the configured Tango runtime rather than constructing adapters directly. The root ORM package still exports the connection surface for code that needs to choose, register, or construct a concrete backend explicitly.

`AdapterRegistry`, `connectDB(...)`, and `getDefaultAdapterRegistry()` are the entrypoints for adapter selection and connection setup. Reach for them when startup code, tests, or tooling need to choose a backend directly instead of relying on the default runtime flow.

`PostgresAdapter` and `SqliteAdapter` are the built-in SQL adapters shipped with Tango.

`Adapter` and `AdapterConfig` are the types for code that wants to name the adapter contract directly.

`DBClient` is the low-level client contract used beneath the ORM manager and queryset layers. Within the `connection` namespace, Tango also exposes `PostgresClient` and `SqliteClient` for code that needs the concrete built-in client implementations.

## Runtime exports

The runtime exports manage the active ORM runtime and the `objects` managers attached to models.

Use `initializeTangoRuntime(...)` when application startup should initialize the process-default runtime from a config loader explicitly.

Use `getTangoRuntime()` when code needs to access that process-default runtime, including the lazy default that loads Tango config from the project root on first use.

Use `resetTangoRuntime()` when tests or tooling need to drop the current runtime and release its cached client.

`TangoRuntime` is the concrete runtime class for code that needs to work with the runtime object directly.

## Query-domain exports

The query-domain exports are the lower-level types and helpers behind the public queryset surface.

`FilterInput`, `OrderToken`, and `QNode` are the main types for code that needs to construct or inspect query conditions directly.

`QueryResult`, `QueryExecutor`, `QueryCompiler`, and `CompiledQuery` are the execution-side contracts for code that needs to inspect compiled queries or participate in lower-level query execution.

`TableMeta` and `RelationMeta` are the metadata contracts the compiler uses when it reasons about table shape and declared relations.

These exports are most useful in adapter work, query tooling, and lower-level ORM tests.

## Related pages

- [ORM and QuerySets](/topics/orm-and-querysets)
- [Models and schema](/topics/models-and-schema)
- [Build your API with viewsets](/how-to/build-your-api-with-viewsets)
- [Pagination](/how-to/pagination)
