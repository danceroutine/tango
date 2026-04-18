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

### `all()`

Use `all()` when you want the same queryset entrypoint as `query()` but prefer Django-style naming.

```ts
const posts = PostModel.objects.all();
```

`ModelManager.all()` delegates to `query()`, so it produces the same lazy queryset state.

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

### `getOrCreate({ where, defaults? })`

Use `getOrCreate` when one call should return an existing record that matches `where` or create a new one. Tango derives create values from plain filter fields, from `defaults`, and (for `Q` trees) from unambiguous `Q` leaves. If the `where` filter is a `Q` node, you must pass `defaults` with at least one non-primary-key field so the insert is fully specified.

```ts
const { record, created } = await UserModel.objects.getOrCreate({
    where: { email: 'user@example.com' },
    defaults: { name: 'User' },
});
```

### `updateOrCreate({ where, defaults?, update? })`

Use `updateOrCreate` when a record may already match `where`. If no row matches, Tango creates one (using the same payload rules as `getOrCreate`). If a row matches, Tango applies `update` when it is present, otherwise it applies `defaults` as the patch. An empty patch does not run an update.

```ts
const { record, created, updated } = await UserModel.objects.updateOrCreate({
    where: { email: 'user@example.com' },
    defaults: { name: 'User' },
    update: { name: 'Updated' },
});
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

## Transactions

Some application workflows need several ORM writes to commit or roll back as one unit. `transaction.atomic(...)` defines that boundary.

```ts
import { transaction } from '@danceroutine/tango-orm';

await transaction.atomic(async (tx) => {
    const user = await UserModel.objects.create({
        email: 'author@example.com',
    });

    await ProfileModel.objects.create({
        userId: user.id,
    });

    tx.onCommit(() => {
        invalidateUserCache(user.id);
    });
});
```

Outside `atomic(...)`, Tango uses the normal autocommit path. Inside `atomic(...)`, manager writes, querysets, and write hooks use the active transaction lease for the current async call chain.

At the persistence layer, the outer block follows the usual SQL transaction shape:

```sql
BEGIN;
-- manager-backed writes
COMMIT;
```

If the callback throws, Tango rolls the transaction back and rejects the `atomic(...)` call with that failure.

### Nested `atomic()` blocks

Nested `atomic()` blocks create savepoints instead of opening unrelated transactions.

```ts
await transaction.atomic(async () => {
    await AuditLogModel.objects.create({ event: 'outer-start' });

    await transaction.atomic(async () => {
        await DraftModel.objects.create({ title: 'temporary' });
    });
});
```

At the persistence layer, Tango uses a savepoint on the already-leased transaction client:

```sql
BEGIN;
SAVEPOINT tango_sp_0;
-- nested manager-backed writes
RELEASE SAVEPOINT tango_sp_0;
COMMIT;
```

A nested failure rolls work back only to that savepoint. If the error keeps propagating, the outer `atomic(...)` call fails as well.

`tx.savepoint(...)` provides the same nested-savepoint behavior without requiring a local `try`/`catch` when the outer transaction should continue:

```ts
await transaction.atomic(async (tx) => {
    const result = await tx.savepoint(async () => {
        await DraftModel.objects.create({ title: 'temporary' });
        throw new Error('discard this draft');
    });

    if (!result.ok) {
        await AuditLogModel.objects.create({ event: 'draft-discarded' });
    }
});
```

By default, `tx.savepoint(...)` returns `{ ok: true, value }` on success and `{ ok: false, error }` on rollback. Pass `{ throwOnError: true }` when the nested savepoint should rethrow instead of returning a result object.

### `tx.onCommit(callback, options?)`

Some side effects should run only after the outermost commit succeeds. `tx.onCommit(...)` registers that work with the current transaction frame.

```ts
await transaction.atomic(async (tx) => {
    const post = await PostModel.objects.create({
        title: 'Queued publish',
        slug: 'queued-publish',
    });

    tx.onCommit(() => {
        publishPostEvent(post.id);
    });
});
```

The callback queue belongs to the current transaction frame:

- callbacks run only after the outermost commit succeeds
- callbacks registered in a nested block are discarded if that savepoint rolls back
- successful nested blocks merge their callbacks into the parent in registration order

`robust: false` is the default. In that mode, the first callback failure stops later callbacks and rejects `atomic(...)` after the database has already committed. With `robust: true`, Tango logs the callback failure and continues with later callbacks.

### Why Tango uses `tx.onCommit(...)`

Django exposes a package-level `transaction.on_commit(...)` helper because Python code often leans on ambient transaction context. Tango keeps ordinary ORM reads and writes ambient inside `atomic(...)`, but it keeps post-commit registration explicit.

That split matters because the two concerns are different. Querysets, manager writes, and hooks should quietly join the active transaction once the boundary exists. Post-commit callbacks are different: they introduce new work that is tied to the commit outcome, so Tango makes that registration happen through the `tx` value that established the boundary. In practice, helper code that only reads or writes through the ORM needs no extra argument, while helper code that must enqueue commit-aware side effects can accept the narrow `AtomicTransaction` contract directly.

### Backend notes

The transaction contract stays the same across supported SQL backends. The runtime notes below are split by dialect because connection management and operational limits still vary.

#### PostgreSQL

PostgreSQL uses one shared pool for ordinary autocommit work and leases one dedicated `PoolClient` for each outer `atomic()` block.

#### SQLite

SQLite supports `transaction.atomic(...)` only on file-backed databases in this milestone. `:memory:` SQLite still works for ordinary autocommit queries, but `atomic(...)` rejects because the transaction workflow needs a second handle to the same database file.

Concurrent outer SQLite transactions still follow normal SQLite file-locking semantics, so overlapping write transactions are not guaranteed to succeed together.

## `QueryResult<T>`

`fetch()` returns a `QueryResult<T>` value. Application code treats it like a small read surface over the materialized rows: sync `for...of`, `length`, `map(...)`, `at(...)`, spread, and destructuring behave like ordinary arrays.

`items` lists the hydrated rows for this execution. `nextCursor` carries opaque pagination state when a higher layer supplies it; materializing a queryset through `fetch()` sets `nextCursor` to `null` today because cursor pagination lives in the resource layer.

`toArray()` returns a shallow copy when application code needs a plain `T[]` value for APIs that expect arrays.

The deprecated `results` getter still returns the same backing list and logs a one-time warning at access time.

## `QuerySet<TModel, TBaseResult = TModel, TSourceModel = unknown, THydrated = Record<never, never>>`

`QuerySet` represents a database query against one model. Each refinement returns a new queryset, leaving the earlier one unchanged. A queryset refinement only describes work. An execution method is a terminal call that sends SQL to the database and returns a promise, such as `fetch(...)`, `fetchOne(...)`, `count()`, or `exists()`.

Django's `QuerySet` is evaluated when the result is needed; in Tango, that moment is an explicit async call such as `fetch()`, a scalar terminal such as `get()`, or async iteration: `for await...of` over a queryset runs one `fetch()` for that queryset state and yields each row from the returned `QueryResult`. Page-oriented callers still reach for `fetch()` first; it is not deprecated.

The generic parameters track the full model record type, the current base projection, the source model used for relation typing, and any hydrated relation properties that should be attached when a row-returning execution method runs.

### `all()`

Call `all()` on a queryset to return a new queryset with the same state. It is a no-op clone, similar to Django's `all()`.

```ts
const base = PostModel.objects.query();
const same = base.all();
```

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

const [first] = postCards;
first?.id;
first?.title;
```

When Tango compiles the query, model fields become database columns:

```sql
SELECT posts.id, posts.title
FROM posts
ORDER BY posts.id ASC
```

Widened field arrays still narrow the SQL projection, but the fetched record type falls back to the full model record because TypeScript can no longer prove which exact fields are present. Calling `select([])` resets the base projection to the full model record. A later `select(...)` call replaces the earlier base projection instead of composing with it.

### `selectRelated(...relations)`

Use `selectRelated(...)` when the requested path stays single-valued from hop to hop. It follows single-valued relation metadata through SQL joins and attaches the hydrated models to the returned result. Missing related records become `null` at the point where the path stops matching.

```ts
const posts = await PostModel.objects.query().filter({ published: true }).selectRelated('author__profile').fetch();

const firstPost = posts.at(0);
firstPost?.id;
firstPost?.author?.email;
firstPost?.author?.profile?.displayName;
```

`selectRelated(...)` accepts nested paths such as `author__profile`, but it rejects any path that crosses a collection edge. A path like `posts__author` belongs in `prefetchRelated(...)`, not `selectRelated(...)`.

Tango still provides strict type safety for forward relations from the model schema, and the generated relation registry extends that typing to nested path unions:

```ts
const PostSchema = z.object({
    authorId: t.foreignKey(t.modelRef<typeof UserModel>('blog/User'), {
        name: 'author',
        relatedName: 'posts',
    }),
});
```

When Tango compiles that queryset, it uses left joins and column aliases so the returned rows contain enough information to hydrate `author` and `profile` after the query runs:

```sql
SELECT posts.*,
       author.id AS author__id,
       author.email AS author__email,
       profile.id AS author__profile__id,
       profile.display_name AS author__profile__display_name
FROM posts
LEFT JOIN users author ON author.id = posts.authorId
LEFT JOIN profiles profile ON profile.user_id = author.id
WHERE posts.published = ?
ORDER BY posts.id ASC
```

### `prefetchRelated(...relations)`

In contrast, use `prefetchRelated(...)` when the requested path includes a collection edge. Prefetch paths may continue beyond that edge, so one branch can still hydrate deeper single-valued or collection-valued descendants.

```ts
const users = await UserModel.objects.query().prefetchRelated('posts__author', 'posts__comments').fetch();

const firstUser = users.at(0);
const firstPost = firstUser?.posts.at(0);
const firstComment = firstPost?.comments.at(0);

firstUser?.id;
firstPost?.title;
firstPost?.author?.email;
firstComment?.body;
```

`prefetchRelated(...)` runs the base query first, then runs batched follow-up queries for the planned collection edges. A user record with no matching posts still receives `posts: []`, and a post record with no matching comments receives `comments: []`.

```sql
SELECT users.*
FROM users
ORDER BY users.id ASC;

SELECT id, authorId, title, published
FROM posts
WHERE authorId IN (?, ?, ?)
ORDER BY authorId ASC;

SELECT id, postId, body
FROM comments
WHERE postId IN (?, ?, ?)
ORDER BY postId ASC;
```

Generated relation typing is the supported path for reverse and nested path ergonomics. In the common case, reverse calls no longer need an explicit target-model generic. That generic still remains as a compatibility fallback when generated typing is absent or stale:

```ts
const users = await UserModel.objects.query().prefetchRelated<typeof PostModel>('posts').fetch();
```

Finite cyclic paths are also valid at runtime. Tango can execute a path such as `manager__manager`, while generated typing intentionally stops at a bounded cyclic expansion horizon. That horizon keeps recursive path unions from growing without bound in TypeScript, which avoids disproportionate compile-time and editor cost for deeply self-referential model graphs. Deeper recursive paths therefore fall back to weaker typing instead of becoming runtime-invalid.

### Projection and hydrated relations

Tango tracks the base model projection separately from hydrated relation properties. A later `select(...)` call replaces the selected base fields while keeping previously requested relation hydration.

```ts
const withAuthor = PostModel.objects.query().selectRelated('author');
// QuerySet<Post, Post, typeof PostModel, { author: User | null }>

const postCards = withAuthor.select(['id', 'title'] as const);
// QuerySet<Post, Pick<Post, 'id' | 'title'>, typeof PostModel, { author: User | null }>

const page = await postCards.fetch();

const [first] = page;
first?.id;
first?.title;
first?.author?.email;
```

The result contains the selected `PostModel` fields and the hydrated `author` model. The stored `authorId` field is not part of the base projection unless it is selected explicitly.

### `fetch(shape?)`

Use `fetch(shape?)` when application code wants all records for the current query. The return type is `QueryResult<Out>`; see [`QueryResult<T>`](#queryresultt) for iteration and array-like helpers.

At the queryset level, `nextCursor` on the returned value is `null`. Cursor pagination belongs to resource paginators rather than the queryset contract itself.

```ts
const page = await PostModel.objects.query().filter({ published: true }).fetch();
page.map((post) => post.id);
```

Call `toArray()` when you need a plain array value:

```ts
const page = await PostModel.objects.query().filter({ published: true }).fetch();
const posts = page.toArray();
posts.map((post) => post.id);
```

### Iterating a completed fetch

```ts
const page = await PostModel.objects.query().filter({ published: true }).fetch();
for (const post of page) {
    post.title;
}
```

### Iterating a queryset

```ts
const queryset = PostModel.objects.query().filter({ published: true });
for await (const post of queryset) {
    post.title;
}
```

### `fetchOne(shape?)`

Use `fetchOne(shape?)` when application code only needs the first model record that matches the current query. It applies `limit(1)` internally and returns that record or `null`.

```ts
const first = await PostModel.objects.query().orderBy('title').fetchOne();
```

`first(shape?)` is an alias for `fetchOne(shape?)`.

The SQL is the current query with a one-record limit:

```sql
SELECT posts.*
FROM posts
ORDER BY posts.title ASC
LIMIT 1
```

### `last(shape?)`

Use `last(shape?)` when application code wants the last row in the sense of "reverse the current `orderBy` spec and take one." If the queryset has no ordering, Tango orders by primary key descending before applying `limit(1)`.

```ts
const newest = await PostModel.objects.all().orderBy('createdAt').last();
```

### `get(q, shape?)`

Use `get(q, shape?)` when exactly one row must match. It applies `filter(q)`, limits internally to detect ambiguity, and throws `NotFoundError` when no row matches or `MultipleObjectsReturned` when more than one row matches.

```ts
const post = await PostModel.objects.all().get({ slug: 'hello' });
```

### `count()`

Use `count()` when application code needs the number of matching records rather than the records themselves.

```ts
const total = await PostModel.objects.query().filter({ published: true }).count();
```

`count()` executes a scalar query from the current queryset state. It strips eager-loading directives before compilation, so it does not validate, assemble, or prefetch hydrated relation work.

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

`exists()` follows the scalar execution path and returns a boolean. Like `count()`, it strips eager-loading directives before compilation and does not assemble hydrated objects or run prefetch follow-up queries.

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
