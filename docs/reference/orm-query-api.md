# ORM query API

`@danceroutine/tango-orm` provides the query and write surface behind `Model.objects`. The concepts here build on [ORM and QuerySets](/topics/orm-and-querysets) and [Models and schema](/topics/models-and-schema), so those pages are the better starting point if you are still learning the ORM.

Throughout the examples below, assume an application with a `PostModel` whose row shape includes fields such as `id`, `title`, `slug`, `published`, and `createdAt`.

## `Model.objects` and `ModelManager<T>`

Every Tango model receives an `objects` property once the ORM runtime is initialized. That property is the model's default manager. The first time application code reads `PostModel.objects`, Tango creates a `ModelManager<Post>` for the active runtime and caches it for that model and runtime.

`ModelManager<T>` is the model-specific entrypoint for one table. It starts queries, looks up rows by primary key, and performs writes through Tango's normal ORM contract.

### `query()`

`query()` starts a new `QuerySet<TModel, TModel>`.

```ts
const posts = PostModel.objects.query();
```

That queryset can then be filtered, ordered, sliced, projected, and eventually evaluated with `fetch(...)`, `fetchOne(...)`, `count()`, or `exists()`.

### `findById(id)` and `getOrThrow(id)`

`findById(id)` returns one row or `null`. `getOrThrow(id)` returns one row or throws `NotFoundError` when the row does not exist.

```ts
const post = await PostModel.objects.findById(42);
const requiredPost = await PostModel.objects.getOrThrow(42);
```

Application code usually chooses between them based on whether a missing record is an ordinary branch or a real error.

### `create(input)`, `update(id, patch)`, `delete(id)`, and `bulkCreate(inputs)`

These methods are the standard write path through the ORM. Model-owned write hooks run here, so create, update, delete, and bulk insert behavior that belongs to the model stays attached to the same contract.

```ts
const created = await PostModel.objects.create({
    title: 'First post',
    slug: 'first-post',
});

const samePost = await PostModel.objects.findById(created.id);

const updated = await PostModel.objects.update(created.id, {
    published: true,
});
```

`bulkCreate(inputs)` performs the same job for multiple records at once.

All of these operations run through Tango's runtime-owned database client lifecycle, so the ordinary application path stays focused on model data and query intent rather than client setup.

## `QuerySet<TModel, TResult = TModel>`

`QuerySet<TModel, TResult = TModel>` represents an immutable database query against one model. Most queryset methods return a new queryset. The methods that actually run the query are covered later in this section.

`TModel` is the full model row type used while the query is being constructed. `TResult` is the row type returned by evaluation methods. That split lets `select(...)` narrow returned rows without changing how `filter(...)`, `exclude(...)`, or `orderBy(...)` are typed.

### Methods that return new `QuerySet`s

#### `filter(q)`

Returns a new `QuerySet` containing rows that match the supplied filter.

Object-literal filters use Tango's field-lookup syntax. Multiple keys in the same filter object are joined with `AND`. For more complex boolean logic, pass a `Q` expression instead.

```ts
const publishedPosts = await PostModel.objects
    .query()
    .filter({ published: true, slug__icontains: 'tango' })
    .fetch();
```

Chaining multiple `filter(...)` calls combines those filters into the final query.

#### `exclude(q)`

Returns a new `QuerySet` containing rows that do not match the supplied filter.

```ts
const visiblePosts = await PostModel.objects
    .query()
    .filter({ published: true })
    .exclude({ slug__icontains: 'draft' })
    .fetch();
```

Each `exclude(...)` call adds another negated predicate to the query.

#### `orderBy(...tokens)`, `limit(n)`, and `offset(n)`

These methods control result ordering and slicing.

```ts
const recentPosts = await PostModel.objects
    .query()
    .orderBy('-createdAt')
    .limit(10)
    .offset(20)
    .fetch();
```

`orderBy(...)` accepts ascending field names such as `'title'` and descending tokens such as `'-createdAt'`. `limit(...)` caps the number of returned rows. `offset(...)` skips the first part of the ordered result set.

#### `select(...)`

`select(...)` narrows the projection so the database returns only the selected model fields.

```ts
const postHeaders = await PostModel.objects
    .query()
    .select(['id', 'title', 'slug'] as const)
    .orderBy('-createdAt')
    .fetch();
```

When the selected fields are known precisely at the call site, `select(...)` narrows the queryset from `QuerySet<TModel, TModel>` to a queryset whose `TResult` is the selected subset. Inline literals, readonly tuples, and `as const` arrays preserve the strongest narrowing.

Widened field arrays still produce the narrower projection, but the returned TypeScript type falls back to the full model row because TypeScript can no longer prove which exact fields are present.

```ts
const fields: ReadonlyArray<'id' | 'title' | 'slug'> = ['id', 'title', 'slug'];

const projected = await PostModel.objects.query().select(fields).fetch();
// projected.results: PostRow[]
```

Calling `select([])` resets back to the full model projection. A later `select(...)` call replaces the earlier projection instead of composing with it.

#### `selectRelated(...rels)` and `prefetchRelated(...rels)`

These methods influence how related data should be fetched.

```ts
const posts = await PostModel.objects
    .query()
    .filter({ published: true })
    .selectRelated('author')
    .prefetchRelated('comments')
    .fetch();
```

`selectRelated(...)` participates in SQL join planning where the model's relation metadata supports it. It does not yet hydrate nested related model objects onto each returned row. `prefetchRelated(...)` records relation names for prefetch behavior where the active adapter supports it.

### Methods that evaluate the query

#### `fetch(shape?)`

`fetch()` evaluates the queryset and returns a `QueryResult<TResult>` with `results` and `nextCursor`.

```ts
const many = await PostModel.objects.query().filter({ published: true }).fetch();
```

At the queryset level, `nextCursor` is currently `null`. Cursor pagination belongs to resource paginators rather than the queryset contract itself.

`fetch(shape?)` also accepts either a shaping function or a parser object. In that form it returns `QueryResult<Out>` instead.

```ts
const titles = await PostModel.objects
    .query()
    .filter({ published: true })
    .fetch((row) => row.title);
```

`select(...)` and `fetch(shape?)` solve different problems. `select(...)` changes the projection the database returns. `fetch(shape?)` changes the result shape the caller receives after the query has run.

If a queryset has already been narrowed with `select(...)`, the shaping function or parser is typed to that selected subset.

#### `fetchOne(shape?)`

`fetchOne()` evaluates the queryset and returns the first row or `null`. Internally it applies `limit(1)` before executing the query.

```ts
const one = await PostModel.objects.query().filter({ slug: 'first-post' }).fetchOne();
```

Like `fetch(...)`, `fetchOne(shape?)` accepts either a shaping function or a parser object. Without a shaping argument it returns `TResult | null`. With one it returns `Out | null`.

```ts
const card = await PostModel.objects
    .query()
    .filter({ published: true })
    .fetchOne({
        parse: (row) => ({ title: row.title, slug: row.slug }),
    });
```

#### `count()`

`count()` evaluates the queryset and returns the number of matching rows.

```ts
const publishedCount = await PostModel.objects.query().filter({ published: true }).count();
```

Use `count()` when application code needs the number of matching rows rather than the rows themselves.

#### `exists()`

`exists()` evaluates the queryset and returns whether at least one row matches.

```ts
const hasPublishedPosts = await PostModel.objects.query().filter({ published: true }).exists();
```

Use `exists()` when application code only needs to know whether at least one row matches.

## `Q`

`Q` is the boolean-expression builder for nested query logic. Reach for it when one plain filter object no longer expresses the condition clearly.

The package also exports `QBuilder` directly for code that needs the concrete builder class, but most application code uses the shorter `Q` entrypoint.

The main helpers are:

- `Q.and(...)`
- `Q.or(...)`
- `Q.not(...)`

```ts
const searchResults = await PostModel.objects
    .query()
    .filter(
        Q.and(
            Q.or({ title__icontains: 'tango' }, { slug__icontains: 'tango' }),
            Q.not({ published: false })
        )
    )
    .fetch();
```

`Q.and(...)`, `Q.or(...)`, and `Q.not(...)` make grouped boolean expressions explicit and keep that logic inside the queryset instead of hand-assembling ad hoc query fragments.

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
