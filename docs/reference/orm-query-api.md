# ORM query API

Use this page when application code already works at the ORM layer and you need the exact contracts for model-backed reads, writes, transactions, and relation hydration. For a narrative introduction to the same surface, see [ORM and QuerySets](/topics/orm-and-querysets).

Throughout this reference the examples use a blog domain: `PostModel`, `UserModel`, and `CommentModel`. Posts relate to authors through `author`; users expose authored posts through the reverse name `posts`.

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

Use `getOrCreate` when one call should return an existing record that matches `where` or create a new one. Tango derives create values from plain filter fields, from `defaults`, and, for unambiguous `Q` trees, from plain equality leaves. The lookup must identify at most one existing record; otherwise Tango raises `MultipleObjectsReturned`. If the `where` filter is a `Q` node, pass `defaults` with at least one non-primary-key field so the insert is fully specified.

```ts
const { record, created } = await UserModel.objects.getOrCreate({
    where: { email: 'user@example.com' },
    defaults: { active: true },
});
```

### `updateOrCreate({ where, defaults?, update? })`

Use `updateOrCreate` when a record may already match `where`. If no row matches, Tango creates one using the same payload rules as `getOrCreate`. If one row matches, Tango applies `update` when it is present; otherwise it applies `defaults` as the patch. An empty patch does not run an update. If more than one existing row matches, Tango raises `MultipleObjectsReturned`.

```ts
const { record, created, updated } = await UserModel.objects.updateOrCreate({
    where: { email: 'user@example.com' },
    defaults: { active: true },
    update: { active: false },
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

### Many-to-many relations on persisted records

Every persisted record returned by the manager carries a related-manager accessor for each many-to-many relation declared on the source model. The accessor is named after the published forward relation name, so a field such as `tagIds: t.manyToMany(..., { name: 'tags' })` exposes `post.tags`. The accessor is attached non-enumerably, which keeps `JSON.stringify(post)` and other enumeration helpers focused on the persisted columns.

```ts
const post = await PostModel.objects.getOrThrow(postId);

await post.tags.add(tag, featuredTag);
await post.tags.remove(tag, featuredTag);
```

`add(...targets)` and `remove(...targets)` accept target records, objects that carry the target primary key, or bare primary-key values. `add(...)` is idempotent for duplicate memberships, so repeated links do not raise a duplicate-row error. When one call touches several targets, Tango resolves the target primary keys once and runs the membership write inside one `transaction.atomic(...)` boundary.

Use `post.tags.all()` when application code wants to read the linked targets. The returned queryset reads through the join table and follows the standard `QuerySet` contract, so it accepts `filter(...)`, `exclude(...)`, `orderBy(...)`, `select(...)`, `fetch(...)`, `fetchOne(...)`, `count()`, and `exists()`.

```ts
const allTags = await post.tags.all().fetch();
const featuredTags = await post.tags.all().filter({ featured: true }).fetch();
```

`post.tags` remains a related manager even after eager loading. `prefetchRelated('tags')` warms that manager's cache; it does not replace the relation with a plain array on the model instance. This mirrors the Django-style contract that Tango follows for many-to-many accessors.

When `prefetchRelated('tags')` ran in the same fetch, `post.tags.all()` returns the prefetched targets without issuing a follow-up query. The prefetch result is cached on the related manager and a successful `add(...)` or `remove(...)` invalidates that cache so the next read returns fresh data. If application code or a serializer needs an array-shaped value, materialize it explicitly from the manager with `await post.tags.all().fetch()`.

Reverse many-to-many access, the bulk `set(...)` helper, the `clear()` helper, and `create(...)` on the related manager are tracked on the roadmap for a follow-up release.

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

## `QuerySet<TModel, TBaseResult = TModel, TSourceModel = unknown, THydrated = Record<never, never>>`

`QuerySet` describes a single-model read query. Refinement methods return a **new** queryset and do not mutate the previous one. Nothing hits the database until you call an execution method (`fetch`, `fetchOne`, `count`, `exists`, or async iteration over the queryset).

The type parameters track, in order, the full model row, the current base projection, the source model used for relation typing, and hydrated relation fields added through `selectRelated(...)` or `prefetchRelated(...)`.

### When a `QuerySet` evaluates

You evaluate a queryset by calling an execution method or by driving async iteration:

- **`fetch(...)`** runs the compiled SQL (and relation hydration) and returns `QueryResult`.
- **`fetchOne(...)`** applies `limit(1)` internally and returns the first row or `null`.
- **`count()`** and **`exists()`** run appropriate aggregate or existence queries.
- **`for await (const x of queryset)`** evaluates the queryset on first use and yields each element from the resulting `QueryResult`.

After the first row-returning evaluation, the same queryset instance reuses its cached materialized result on later `fetch()` or async-iteration calls. Refine the queryset first if you want a different SQL query or a different result cache.

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

In contrast, use `prefetchRelated(...)` when the requested path includes a collection edge. Valid collection edges include `hasMany` relations and many-to-many relations backed by a join table. Prefetch paths may continue beyond that edge, so one branch can still hydrate deeper single-valued or collection-valued descendants.

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

Many-to-many prefetch reads the join table once for the batched owners, then loads targets by primary key in a follow-up query. The prefetched targets seed the related-manager cache on each owner, so a follow-up `post.tags.all().fetch()` returns the prefetched targets without another database round-trip. The model instance still exposes `tags` as a related manager, not as a plain `Tag[]`.

Forward many-to-many path typing comes from the generated relation registry. Without generated relation typing, the older explicit target-model generic still only supplies reverse `hasMany` path typing; the runtime can still execute the many-to-many prefetch path, but TypeScript will need the generated registry to describe it precisely.

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

const result = await postCards.fetch();

const [first] = result;
first?.id;
first?.title;
first?.author?.email;
```

The result contains the selected `PostModel` fields and the hydrated `author` model. The stored `authorId` field is not part of the base projection unless it is selected explicitly.

### `fetch(shape?)`

Use `fetch(shape?)` when application code wants the materialized result for the current queryset state. `fetch()` runs the query, performs any relation hydration, and returns a `QueryResult`.

```ts
const result = await PostModel.objects.query().filter({ published: true }).fetch();
result.map((post) => post.id);
```

When you provide a shaping function or parser, Tango applies it after hydration and stores the shaped values in the returned `QueryResult`.

### Returned `QueryResult<T>`

`QueryResult<T>` is the materialized result object returned by `fetch(...)`. It preserves the execution order of the query and supports the common ways application code reads a materialized result: iteration, `length`, `map`, `at`, `items`, and `toArray()`.

#### `items`

Read-only array of the values for this execution, in database order unless the queryset applied `orderBy(...)`.

#### `toArray(): T[]`

Returns a shallow copy as a mutable `T[]` for APIs that expect a plain array.

Call `toArray()` when application code needs a mutable array value:

```ts
const result = await PostModel.objects.query().filter({ published: true }).fetch();
const posts = result.toArray();
posts.map((post) => post.id);
```

Complete `fetch()` first, then iterate if you want evaluation to be explicit:

```ts
const result = await PostModel.objects.query().filter({ published: true }).fetch();
for (const post of result) {
    post.title;
}
```

You can also iterate the queryset directly; that path evaluates the queryset:

```ts
const queryset = PostModel.objects.query().filter({ published: true });
for await (const post of queryset) {
    post.title;
}
```

If that same queryset instance is iterated again later, Tango reuses the cached materialized result instead of issuing another database round-trip.

Older code may still read `result.results`. That getter remains available for compatibility, but it emits a one-time deprecation warning per process. Prefer `result.items`, iteration, `length`, `map`, `at`, or `toArray()` in new code.

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

## Lower-level entrypoints

Most application code stops at `Model.objects`, `QuerySet`, and `transaction`. Reach for the lower-level exports when startup code, tests, adapters, or query tooling need more control over runtime or SQL behavior.

- Use the connection exports such as `connectDB(...)`, `AdapterRegistry`, `PostgresAdapter`, `SqliteAdapter`, and `DBClient` when code needs to choose or construct a backend explicitly.
- Use the runtime exports such as `initializeTangoRuntime(...)`, `getTangoRuntime()`, `resetTangoRuntime()`, and `TangoRuntime` when startup or test code needs to manage the active ORM runtime directly.
- Use query-domain contracts such as `FilterInput`, `OrderToken`, `QNode`, `QueryExecutor`, `QueryCompiler`, `CompiledQuery`, `TableMeta`, and `RelationMeta` when lower-level code needs to inspect or participate in query compilation.

## Related pages

- [ORM and QuerySets](/topics/orm-and-querysets)
- [Models and schema](/topics/models-and-schema)
- [Build your API with viewsets](/how-to/build-your-api-with-viewsets)
- [Pagination](/how-to/pagination)
