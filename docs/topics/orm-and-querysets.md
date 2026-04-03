# ORM and QuerySets

Once you have defined your models, Tango gives you a database access API that lets application code create, retrieve, update, and delete stored records. This topic explains how that API works through `Model.objects` and `QuerySet`.

Throughout this page, assume a blog application with models such as `PostModel` and `UserModel`. The examples focus on blog posts because they make it easy to talk about common query patterns such as "published posts," "posts by this author," and "the newest posts first."

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

The simplest queryset begins with `query()`:

```ts
const allPosts = PostModel.objects.query();
```

At that point, no filtering, ordering, or limiting has been applied. The queryset represents the base table query for posts.

## Refining queries

Most queryset work comes down to refining that base query.

`filter(...)` narrows the result set to rows that match the given conditions. `exclude(...)` removes rows that match the given conditions. `orderBy(...)` controls result ordering. `limit(...)` and `offset(...)` define which slice of the result set should be returned.

For example:

```ts
const recentPosts = PostModel.objects
    .query()
    .filter({ published: true })
    .orderBy('-createdAt')
    .limit(20);
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
const queryset = PostModel.objects
    .query()
    .filter({ published: true })
    .orderBy('-createdAt')
    .limit(10);

const posts = await queryset.fetch();
```

The earlier `filter(...)`, `orderBy(...)`, and `limit(...)` calls only build the query. `fetch()` is the point where Tango actually asks the database for rows.

## Retrieving records

Different retrieval methods communicate different expectations about the result.

If you want a flexible query that may return many rows, start with `query()` and finish with `fetch()`:

```ts
const publishedPosts = await PostModel.objects
    .query()
    .filter({ published: true })
    .fetch();
```

If you expect at most one row from a refined queryset, use `fetchOne()`:

```ts
const latestPost = await PostModel.objects
    .query()
    .filter({ published: true })
    .orderBy('-createdAt')
    .fetchOne();
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
    .filter(
        Q.or(
            { title__icontains: 'tango' },
            { content__icontains: 'tango' }
        )
    )
    .fetch();
```

You reach for `Q` when one plain filter object no longer captures the query clearly.

## Shaping query results

Sometimes application code wants the full model row. Sometimes it only needs a few columns, or it wants to transform the returned rows into another shape.

`select(...)` narrows the selected columns:

```ts
const postHeaders = await PostModel.objects
    .query()
    .select(['id', 'title', 'slug'])
    .orderBy('-createdAt')
    .fetch();
```

At execution time, that changes the SQL projection, so the database returns only the selected columns. In other words, `postHeaders` contains rows with `id`, `title`, and `slug`, not complete post records with every model field still present.

The TypeScript surface does not yet narrow automatically from `select(...)` alone. The queryset still begins from the model's row contract, so if application code wants the narrower result shape to be explicit in its own types, it is usually clearer to pair `select(...)` with a shaping function or parser.

`fetch(...)` can also accept a shaping function or parser when the calling code wants to project the returned rows into another form:

```ts
const titles = await PostModel.objects
    .query()
    .filter({ published: true })
    .fetch((row) => row.title);
```

This keeps the query definition and the result shape close together when a caller needs a narrower view of the returned data.

## Working with related data

Relations declared in the model layer also influence queryset behavior.

`selectRelated(...)` tells the ORM which declared relations should participate in SQL join planning. `prefetchRelated(...)` registers relation names for prefetch behavior where the active adapter supports it.

```ts
const posts = await PostModel.objects
    .query()
    .filter({ published: true })
    .selectRelated('author')
    .prefetchRelated('comments')
    .fetch();
```

These methods control how related data should be fetched. They build on relation metadata that already exists in the model contract.

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
