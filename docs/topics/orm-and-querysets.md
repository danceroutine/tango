# ORM and QuerySets

Once you have defined your models, Tango gives you a database access API that lets application code create, retrieve, update, and delete stored records. This topic explains how that API works through `Model.objects` and `QuerySet`.

The examples use a blog application with models such as `PostModel` and `UserModel`. Blog posts make the common query patterns concrete: published posts, posts by one author, and the newest posts first.

## `Model.objects`

Every Tango model exposes a manager at `Model.objects`.

The manager is the main entry point for model-backed work. If application code wants to create a post, retrieve one post, or begin a query for many posts, it usually starts from `PostModel.objects`.

The same manager is also where application code begins read queries:

```ts
const queryset = PostModel.objects.query();
```

`PostModel` describes what a stored blog post is. `PostModel.objects` is the API you use when you want to work with stored blog posts in the database. The manager lives on the model class because it represents table-level work for the post table, while one row instance represents one stored post.

Tango wires this up for you when the ORM runtime is loaded. Each model gains an `objects` property, and the first time application code reads `PostModel.objects`, Tango creates a `ModelManager` for that model against the active Tango runtime. Later reads reuse that manager while the same runtime is active, so application code gets one consistent manager entry point without instantiating managers by hand.

## Creating records

Creating one record is usually as direct as calling `create(...)` on the manager:

```ts
const post = await PostModel.objects.create({
    title: 'Hello, Tango',
    slug: 'hello-tango',
    content: '...',
    published: true,
});
```

When application code needs to insert several rows together, the manager also provides `bulkCreate(...)`:

```ts
await PostModel.objects.bulkCreate([
    {
        title: 'Hello, Tango',
        slug: 'hello-tango',
        content: '...',
        published: true,
    },
    {
        title: 'Second post',
        slug: 'second-post',
        content: '...',
        published: false,
    },
]);
```

These are the normal write paths through the ORM. If a model owns write-time behavior such as defaults or lifecycle hooks, writing through `Model.objects` keeps that behavior in one consistent place.

## `QuerySet`

A `QuerySet` represents a database query before it is executed.

Sometimes that query means "all posts." Sometimes it means "all published posts from this author, ordered by creation date." Sometimes it means "one post with this identifier, if it exists." In each case, the query can keep being refined before Tango asks the database to return rows.

A queryset begins with `query()`:

```ts
const allPosts = PostModel.objects.query();
```

At that point, no filtering, ordering, or limiting has been applied. The queryset represents the base table query for posts.

## Refining queries

Most queryset work comes down to refining that base query.

`filter(...)` narrows the result set to rows that match the given conditions. `exclude(...)` removes rows that match the given conditions. `orderBy(...)` controls result ordering. `limit(...)` and `offset(...)` define which slice of the result set should be returned.

For example:

```ts
const recentPosts = PostModel.objects.query().filter({ published: true }).orderBy('-createdAt').limit(20);
```

You can read that queryset from top to bottom as one sentence about the data the application wants: start from posts, keep the published ones, order them by newest first, and return the first twenty.

## Each refinement returns a new queryset

Refining a queryset does not mutate the previous queryset. Each refinement returns a new `QuerySet`.

```ts
const allPosts = PostModel.objects.query();
const publishedPosts = allPosts.filter({ published: true });
const newestPublishedPosts = publishedPosts.orderBy('-createdAt');
```

`allPosts` still means "all posts." `publishedPosts` means "published posts." `newestPublishedPosts` means "published posts ordered by newest first."

Queryset code becomes easier to reuse this way. One part of the application can keep a base query while another part builds on it without changing the original.

## QuerySets are lazy

Creating and refining a queryset does not execute a database query by itself.

Tango waits until application code asks for results. In everyday use, that means the database is queried when code calls methods such as `fetch()`, `fetchOne()`, `count()`, or `exists()`.

```ts
const queryset = PostModel.objects.query().filter({ published: true }).orderBy('-createdAt').limit(10);

const posts = await queryset.fetch();
```

The earlier `filter(...)`, `orderBy(...)`, and `limit(...)` calls only build the query. `fetch()` is the point where Tango actually asks the database for rows.

## Retrieving records

Different retrieval methods communicate different expectations about the result.

If you want a flexible query that may return many rows, start with `query()` and finish with `fetch()`:

```ts
const publishedPosts = await PostModel.objects.query().filter({ published: true }).fetch();
```

If you expect at most one row from a refined queryset, use `fetchOne()`:

```ts
const latestPost = await PostModel.objects.query().filter({ published: true }).orderBy('-createdAt').fetchOne();
```

If you already know the identifier of the row you want, `findById(...)` or `getOrThrow(...)` often expresses that intent more directly:

```ts
const post = await PostModel.objects.findById(42);
const requiredPost = await PostModel.objects.getOrThrow(42);
```

These choices let the code describe what kind of answer it expects from the database, in addition to which table it wants to query.

## Using `Q` for more complex conditions

Simple object filters are often enough. When the query needs explicit boolean composition, use `Q`.

`Q` lets you express combinations such as "title contains this term or content contains this term," or "this condition must hold, but that other condition must not."

```ts
import { Q } from '@danceroutine/tango-orm';

const searchResults = await PostModel.objects
    .query()
    .filter(Q.or({ title__icontains: 'tango' }, { content__icontains: 'tango' }))
    .fetch();
```

You reach for `Q` when one plain filter object no longer captures the query clearly.

## Shaping query results

Sometimes application code wants the full model row. Sometimes it only needs a few columns, or it wants to transform the returned rows into another shape.

`select(...)` narrows the selected columns:

```ts
const postHeaders = await PostModel.objects.query().select(['id', 'title', 'slug']).orderBy('-createdAt').fetch();
```

At execution time, that changes the SQL projection, so the database returns only the selected columns. In other words, `postHeaders` contains rows with `id`, `title`, and `slug`, not complete post records with every model field still present.

The fetched TypeScript row type narrows with that projection as well when the selected keys are known precisely at the call site. Inline literals, readonly tuples, and `as const` arrays preserve that narrowing automatically.

```ts
const postHeaders = await PostModel.objects
    .query()
    .select(['id', 'title', 'slug'] as const)
    .orderBy('-createdAt')
    .fetch();
```

In that example, each row in `postHeaders.results` is typed as `{ id, title, slug }`.

Widened arrays still work for SQL projection, but they fall back to the full row type because TypeScript can no longer prove which exact keys are present:

```ts
const columns: ReadonlyArray<'id' | 'title' | 'slug'> = ['id', 'title', 'slug'];

const projected = await PostModel.objects.query().select(columns).fetch();
```

`select([])` resets back to the full row, and a later `select(...)` call replaces the earlier projection rather than composing with it.

`fetch(...)` can also accept a shaping function or parser when the calling code wants to project the returned rows into another form:

```ts
const titles = await PostModel.objects
    .query()
    .filter({ published: true })
    .fetch((row) => row.title);
```

This keeps the query definition and the final application-facing shape close together when a caller wants something narrower or more specialized than the selected columns alone.

## Working with related data

Relations declared in the model layer also influence queryset behavior.

Use `selectRelated(...)` when each fetched model record should include one related model. In the blog example, each `PostModel` has one author, so the queryset can attach the hydrated `author` model to each post result.

When Tango prepares the database query for that ORM request, it uses a SQL join between the post table and the author table.

```ts
const posts = await PostModel.objects.query().filter({ published: true }).selectRelated('author').fetch();

posts.results[0].author?.email;
```

`selectRelated(...)` is for single-valued relations such as `belongsTo` and `hasOne`. A missing related row is returned as `null`.

In contrast, use `prefetchRelated(...)` when each fetched model record should include a collection relation such as `hasMany`. In the sample models for this article, the reverse side of `Post.author` is `User.posts`, which is declared on `PostModel`, so the call site supplies the target model generic to keep the reverse relation type-safe:

```ts
const users = await UserModel.objects.query().prefetchRelated<typeof PostModel>('posts').fetch();

users.results[0].posts.map((post) => post.title);
```

In the example above, a user record with no matching posts receives `posts: []`.

Hydrated relation properties stay attached even when the selected model fields change:

```ts
const postCards = await PostModel.objects
    .query()
    .selectRelated('author')
    .select(['id', 'title'] as const)
    .fetch();

postCards.results[0].author?.email;
```

The selected `PostModel` fields in that example are `id` and `title`, while the hydrated `author` model remains available.

::: info
Relation hydration covers direct relations and returns full related models. Many-to-many hydration and nested traversal such as `author__profile` are separate future capabilities.
:::

## Updating and deleting records

The manager also owns the common update and delete path.

```ts
await PostModel.objects.update(42, {
    title: 'Updated title',
});

await PostModel.objects.delete(42);
```

As with `create(...)`, these methods matter because they are the ordinary application path through model-owned persistence behavior. If the model applies defaults or lifecycle hooks during writes, manager-based writes keep that behavior consistent.

## Transaction support

The ORM does not yet provide a supported transaction workflow for application code.

Today, the model manager and queryset APIs cover ordinary reads and writes, but they do not yet expose a stable transaction boundary that application code can rely on for multi-step units of work.

## Related pages

- [Models and schema](/topics/models-and-schema)
- [Build your API with viewsets](/how-to/build-your-api-with-viewsets)
- [Add pagination](/how-to/pagination)
- [ORM query API](/reference/orm-query-api)
