# ORM query API

`@danceroutine/tango-orm` provides the model manager and queryset surface behind `Model.objects`.

Application code usually starts with `Model.objects`. The manager owns lookups and writes for one model. Calling `query()` returns a `QuerySet`, which is the immutable builder for model-backed reads. After those core surfaces, this page covers the lower-level exports that startup code, tests, and tooling may use directly.

The examples below use a blog application with `PostModel`, `UserModel`, and `CommentModel`. A post belongs to one author through the relation name `author`, and a user exposes authored posts through the reverse relation name `posts`.

## `Model.objects` and `ModelManager<TModelRow>`

Every Tango model receives an `objects` property once the ORM runtime is initialized. The first time application code reads `PostModel.objects`, Tango creates a `ModelManager<Post>` for the active runtime and caches it for that model and runtime.

The manager is the model-specific entrypoint for lookups and writes. At the ORM layer, you work with model records and fields. When Tango compiles database work, that model contract becomes SQL over a table and its columns.

### `query()`

Use `query()` when you want to build a read operation over several steps before running it.

```ts
const query = PostModel.objects.query();
```

At the ORM layer, `query()` gives you a queryset for posts. At the persistence layer, that starts from a statement shaped like this:

```sql
SELECT posts.*
FROM posts
ORDER BY posts.id ASC
```

Every queryset refinement returns a new queryset, so application code can keep base queries around and derive narrower versions from them.

### `findById(id)`

Use `findById(id)` when you want one model record by primary key and `null` is an acceptable result.

```ts
const post = await PostModel.objects.findById(42);
```

That manager call is equivalent to building and executing a primary-key queryset:

```sql
SELECT posts.*
FROM posts
WHERE posts.id = ?
ORDER BY posts.id ASC
LIMIT 1
```

### `getOrThrow(id)`

Use `getOrThrow(id)` when the caller expects the record to exist and absence should become a `NotFoundError`.

```ts
const post = await PostModel.objects.getOrThrow(42);
```

The database lookup follows the same primary-key shape as `findById(...)`. The difference is the application-facing contract: `findById(...)` returns `null`, while `getOrThrow(...)` raises an error when the model record is missing.

### `create(input)`

Use `create(input)` when application code should insert one model record through Tango's model-owned write path.

```ts
const created = await PostModel.objects.create({
    title: 'First post',
    slug: 'first-post',
    published: false,
});
```

Tango applies model create hooks and then compiles an insert statement for the supplied fields:

```sql
INSERT INTO posts (title, slug, published)
VALUES (?, ?, ?)
RETURNING *
```

### `update(id, patch)`

Use `update(id, patch)` when application code should patch one existing model record by primary key.

```ts
const updated = await PostModel.objects.update(created.id, {
    published: true,
});
```

Tango loads the current record for hook context, applies update hooks, and then compiles an update statement for the patch fields:

```sql
UPDATE posts
SET published = ?
WHERE id = ?
RETURNING *
```

### `delete(id)`

Use `delete(id)` when application code should delete one model record by primary key through model hooks.

```ts
await PostModel.objects.delete(created.id);
```

The persistence layer receives a delete statement scoped to the primary key:

```sql
DELETE FROM posts
WHERE id = ?
```

### `bulkCreate(inputs)`

Use `bulkCreate(inputs)` when application code should insert several records through one manager call.

```ts
const posts = await PostModel.objects.bulkCreate([
    { title: 'First post', slug: 'first-post' },
    { title: 'Second post', slug: 'second-post' },
]);
```

Tango applies the bulk-create hook path and compiles a multi-row insert for the shared field set:

```sql
INSERT INTO posts (title, slug)
VALUES (?, ?), (?, ?)
RETURNING *
```

## `QuerySet<TModel, TBaseResult = TModel, TSourceModel = unknown, THydrated = Record<never, never>>`

`QuerySet` represents a database query against one model. Each refinement returns a new queryset, leaving the earlier one unchanged. A queryset refinement only describes work. An execution method is a terminal call that sends SQL to the database and returns a promise, such as `fetch(...)`, `fetchOne(...)`, `count()`, or `exists()`.

The generic parameters track the full model record type, the current base projection, the source model used for relation typing, and any hydrated relation properties that should be attached when a row-returning execution method runs.

### `filter(q)` and `exclude(q)`

Use `filter(q)` and `exclude(q)` to describe which model records belong in the result set. `filter(...)` adds normal predicates. `exclude(...)` adds negated predicates.

```ts
const published = PostModel.objects.query().filter({ published: true });

const visible = published.exclude({ slug__icontains: 'draft' });
```

That builds SQL incrementally:

```sql
SELECT posts.*
FROM posts
WHERE posts.published = ?
  AND NOT (posts.slug ILIKE ?)
ORDER BY posts.id ASC
```

### `orderBy(...fields)`, `limit(n)`, and `offset(n)`

Use `orderBy(...)`, `limit(n)`, and `offset(n)` when the query should control ordering or result size. Ordering fields follow the Django-style convention: `'title'` means ascending order, while `'-createdAt'` means descending order.

```ts
const pageQuery = PostModel.objects.query().filter({ published: true }).orderBy('-createdAt').limit(10).offset(20);
```

At the persistence layer, those refinements shape the ordering and slice:

```sql
SELECT posts.*
FROM posts
WHERE posts.published = ?
ORDER BY posts.createdAt DESC
LIMIT 10 OFFSET 20
```

### `select(fields)`

Use `select(fields)` when the application only needs a subset of model fields. When the selected fields are known precisely at the call site, the fetched record type narrows to that projection. Inline literals, readonly tuples, and `as const` arrays preserve the strongest narrowing.

```ts
const postCards = await PostModel.objects
    .query()
    .select(['id', 'title'] as const)
    .fetch();

postCards.results[0].title;
```

When Tango compiles the query, model fields become database columns:

```sql
SELECT posts.id, posts.title
FROM posts
ORDER BY posts.id ASC
```

Widened field arrays still narrow the SQL projection, but the fetched record type falls back to the full model record because TypeScript can no longer prove which exact fields are present. Calling `select([])` resets the base projection to the full model record. A later `select(...)` call replaces the earlier base projection instead of composing with it.

### `selectRelated(...relations)`

Use `selectRelated(...)` when each model record should include one related model. It follows single-valued relation metadata, such as a post's `author`, through a SQL join and attaches the hydrated model to the returned result. Missing related records become `null`.

```ts
const posts = await PostModel.objects.query().filter({ published: true }).selectRelated('author').fetch();

posts.results[0].author?.email;
```

Tango can provide strict type safety for forward relations from the model schema because `PostModel` declares the field that points at `UserModel`:

```ts
const PostSchema = z.object({
    authorId: t.foreignKey(t.modelRef<typeof UserModel>('blog/User'), {
        name: 'author',
        relatedName: 'posts',
    }),
});
```

When this query reaches the persistence layer, Tango uses a left join and aliases the related model's columns so it can assemble `author` after the database returns results:

```sql
SELECT posts.*, author.id AS author__id, author.email AS author__email
FROM posts
LEFT JOIN users author ON author.id = posts.authorId
WHERE posts.published = ?
ORDER BY posts.id ASC
```

### `prefetchRelated(...relations)`

In contrast, use `prefetchRelated(...)` when each model record should include a collection relation. In the sample blog models, the reverse side of `Post.author` is `User.posts`, which is declared on `PostModel`. The call site supplies the target model generic so TypeScript can inspect the model that owns the relationship field and recover the reverse relation type.

```ts
const users = await UserModel.objects.query().prefetchRelated<typeof PostModel>('posts').fetch();

users.results[0].posts.map((post) => post.title);
```

`prefetchRelated(...)` runs the base query first, then runs one follow-up query per prefetched relation. In the example above, a user record with no matching posts receives `posts: []`.

```sql
SELECT users.*
FROM users
ORDER BY users.id ASC;

SELECT id, authorId, title, published
FROM posts
WHERE authorId IN (?, ?, ?)
ORDER BY authorId ASC;
```

The relation hydration contract covers direct relations and full related models. Nested traversal such as `author__profile`, related-model field projection, and many-to-many hydration are separate queryset capabilities.

### Projection and hydrated relations

Tango tracks the base model projection separately from hydrated relation properties. A later `select(...)` call replaces the selected base fields while keeping previously requested relation hydration.

```ts
const withAuthor = PostModel.objects.query().selectRelated('author');
// QuerySet<Post, Post, typeof PostModel, { author: User | null }>

const postCards = withAuthor.select(['id', 'title'] as const);
// QuerySet<Post, Pick<Post, 'id' | 'title'>, typeof PostModel, { author: User | null }>

const page = await postCards.fetch();

page.results[0].title;
page.results[0].author?.email;
```

The result contains the selected `PostModel` fields and the hydrated `author` model. The stored `authorId` field is not part of the base projection unless it is selected explicitly.

### `fetch(shape?)`

Use `fetch(shape?)` when application code wants all records for the current query. It returns a `QueryResult<Out>` object with `results` and `nextCursor`.

```ts
const page = await PostModel.objects.query().filter({ published: true }).orderBy('-createdAt').fetch();
```

At the queryset level, `nextCursor` is currently `null`. Cursor pagination belongs to resource paginators rather than the queryset contract itself.

### `fetchOne(shape?)`

Use `fetchOne(shape?)` when application code only needs the first model record that matches the current query. It applies `limit(1)` internally and returns that record or `null`.

```ts
const first = await PostModel.objects.query().orderBy('title').fetchOne();
```

The SQL is the current query with a one-record limit:

```sql
SELECT posts.*
FROM posts
ORDER BY posts.title ASC
LIMIT 1
```

### `count()`

Use `count()` when application code needs the number of matching records rather than the records themselves.

```ts
const total = await PostModel.objects.query().filter({ published: true }).count();
```

`count()` executes a scalar query from the current queryset state. It does not assemble hydrated objects or run prefetch follow-up queries.

```sql
SELECT COUNT(*) AS count
FROM (
    SELECT posts.*
    FROM posts
    WHERE posts.published = ?
) AS tango_count_subquery
```

### `exists()`

Use `exists()` when application code only needs to know whether at least one record matches.

```ts
const hasDrafts = await PostModel.objects.query().filter({ published: false }).exists();
```

`exists()` follows the scalar execution path and returns a boolean. Like `count()`, it does not assemble hydrated objects or run prefetch follow-up queries.

### Shaping fetched results

`fetch(...)` and `fetchOne(...)` accept an optional shaping function or parser when application code wants to receive a result shape that differs from the current fetched record.

```ts
const titles = await PostModel.objects
    .query()
    .select(['title'] as const)
    .fetch((post) => post.title);

const titleRecord = await PostModel.objects
    .query()
    .select(['title'] as const)
    .fetchOne({
        parse: (post) => ({ title: post.title }),
    });
```

`select(...)` changes the database projection and narrows the fetched model fields when TypeScript can see the field list. `fetch(shape?)` takes the current fetched shape and turns it into the application-facing value the caller wants. When a shaping function or parser is provided, its input uses the current fetched shape, allowing the callback to read selected fields and hydrated relations without casts.

```ts
const summaries = await PostModel.objects
    .query()
    .selectRelated('author')
    .select(['title'] as const)
    .fetch((post) => ({
        title: post.title,
        authorEmail: post.author?.email ?? null,
    }));
```

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
    .filter(Q.and({ published: true }, Q.or({ featured: true }, { visibility: 'public' })))
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
