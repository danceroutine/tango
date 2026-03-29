# ORM and QuerySets

Tango's ORM is model-first. Most application code talks to `Model.objects`, composes queries through `QuerySet`, and leaves runtime initialization to Tango itself.

## The main pieces

`@danceroutine/tango-orm` is organized around four application-facing areas:

- the transparent runtime that loads `tango.config.ts` and manages the shared DB client
- model managers surfaced as `Model.objects`
- query composition through `QuerySet` and `Q`
- transactions through `UnitOfWork`

## `Model.objects`

`Model.objects` is the main entry point for application code.

A model manager gives you:

- `query()` for `QuerySet` composition
- `findById` and `getOrThrow`
- `create`, `update`, `delete`, and `bulkCreate`

That keeps the common path close to Django's `Model.objects` style while preserving explicit query composition and strong typing.

## `QuerySet<T>`

`QuerySet` is immutable. Each call returns a new query object with one more piece of state applied.

It supports:

- `filter(...)`
- `exclude(...)`
- `orderBy(...)`
- `limit(...)`
- `offset(...)`
- `select(...)`
- `selectRelated(...)`
- `prefetchRelated(...)`
- `fetch(...)`
- `fetchOne(...)`
- `count()`
- `exists()`

Execution only happens when you call `fetch`, `fetchOne`, `count`, or `exists`, which keeps query composition separate from execution.

## `Q`

Use `Q` when plain object filters are no longer enough.

`Q` supports:

- `Q.and(...)`
- `Q.or(...)`
- `Q.not(...)`

The Next.js example uses this pattern to search across both `title` and `content`.

## How model code and view code should divide work

A good rule is:

- model managers and query composition answer database questions
- view classes answer HTTP questions

Persistence code should know about tables, filters, ordering, and transactions.

View or viewset code should know about request bodies, URL parameters, status codes, and response shape.

That division is why `ModelViewSet` applies filters and pagination while calling into `Model.objects` for the actual read and write operations.

## Ordering matters more than it looks

Whenever you paginate a list endpoint, specify ordering.

The examples do this consistently:

- published list pages order by `-createdAt`
- list APIs declare `orderingFields` so only approved columns can be requested from the query string

Without explicit ordering, pagination becomes unstable as rows are inserted or updated.

## Dialects

Tango currently ships with `SqliteAdapter` and `PostgresAdapter`.

Most application code remains portable across those dialects because managers and query composition sit above the DB-client boundary. Migration policy, CI coverage, and capability-sensitive behavior should still be validated per backend.

## Related pages

- [ORM query API reference](/reference/orm-query-api)
- [Filtering](/how-to/filtering)
- [Pagination](/how-to/pagination)
