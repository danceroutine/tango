# How to add pagination

Once a list endpoint can return more than a handful of records, clients need a predictable way to move through that result set in smaller pieces. Pagination gives the endpoint that traversal contract.

In Tango, pagination usually enters the application in one of two ways. Some applications rely on Tango's built-in list behavior. Others paginate a queryset directly in custom application code. The same two paginator classes are available in both cases: `OffsetPaginator` and `CursorPaginator`.

Most applications should start with offset pagination. Tango already applies it by default to the built-in list behavior, and it is usually the easiest contract for clients to understand while an API is still taking shape.

## Start with offset pagination

Offset pagination answers a simple question: how many records should this response include, and how far into the full result set should it begin?

Tango's offset paginator accepts these query parameters:

- `limit`
- `offset`
- `page`

`limit` controls the page size. `offset` controls how many matching records to skip before the page begins. `page` is a convenience form for page-number traversal. When a request supplies `page`, Tango translates it into an offset internally by using the current page size.

The response keeps the familiar list payload under `results` and adds pagination metadata around it. A response might look like this:

```json
{
    "count": 100,
    "next": "?limit=20&offset=20",
    "results": []
}
```

When the client is no longer on the first slice of results, Tango also adds a `previous` link. The `count` field tells the client how many matching records exist across the full list, not just on the current page.

### Use the default behavior before configuring anything extra

If your list endpoint already uses Tango's built-in list behavior, offset pagination is usually present without any additional work. `ModelViewSet` and `GenericAPIView` both create an `OffsetPaginator`, read the query parameters, apply the page boundary to the queryset, and serialize the paginated response.

That means many applications can postpone pagination decisions at first. You can define the list resource, make sure the endpoint returns the right records, and only revisit pagination when you need a different traversal style or tighter control over the response contract.

### Give the list a stable order

Pagination is only trustworthy when the list order is deterministic. If the database is free to return rows in an arbitrary order, clients may see duplicates, gaps, or unexpectedly shuffled records as they move from one page to the next.

For that reason, treat ordering as part of the pagination contract. On built-in resources, `orderingFields` is the allowlist that decides which sort keys clients may request. If the endpoint should always use one application-defined order, make sure the queryset that reaches the paginator already has that order applied.

This matters even more when filtering is involved. Before you worry about page size, make sure the endpoint answers two simpler questions reliably:

1. which records belong in the list
2. in what order should those records appear

Once those answers are stable, page traversal becomes much easier to reason about and test.

## Choose cursor pagination when forward traversal must stay stable

Offset pagination is a good default for many list endpoints. Lists that change frequently while clients are paging through them often benefit from a different traversal contract. New rows inserted at the front of the list may push later rows onto different pages.

Cursor pagination is designed for that situation. Instead of saying "skip the first 40 rows," the client follows an opaque cursor token that marks where the next slice should begin.

Tango's cursor paginator accepts these query parameters:

- `limit`
- `cursor`
- `ordering`

The response keeps the same `results` array, but the traversal metadata changes. A cursor-paginated response might look like this:

```json
{
    "next": "?limit=20&cursor=eyJ2IjoxLCJmaWVsZCI6ImNyZWF0ZWRBdCIsImRpciI6ImFzYyIsInZhbHVlIjoiMjAyNi0wNC0wMVQxMjozMDowMC4wMDBaIn0%3D&ordering=createdAt",
    "results": []
}
```

Treat the cursor token as an opaque value. Application documentation should tell clients to follow the `next` and `previous` links that Tango returns. Cursor responses center on traversal links and omit total counts or numeric page positions.

### Pick one stable cursor field

Cursor traversal depends on one field whose ordering can define the path through the list. In practice, that field is often `id`, `createdAt`, or another value that moves in one clear direction and does not need arbitrary reordering.

This is the point where offset and cursor pagination diverge most clearly:

- offset pagination works well when page numbers and total counts are useful to the client
- cursor pagination works well when the client mainly needs reliable forward or backward traversal through a changing list

Choose cursor pagination when stability matters more than random access. A client that needs "page 7" is usually better served by offset pagination. A client that needs "keep following the newest records as the list changes" is usually a better fit for cursor pagination.

### Switch a built-in list endpoint to `CursorPaginator`

On a viewset or generic view, provide a `paginatorFactory` in the resource configuration. This hook tells the resource which paginator to build for the list queryset.

```ts
import { CursorPaginator, ModelViewSet } from '@danceroutine/tango-resources';
import type { Post } from '@/models';
import { PostSerializer } from '@/serializers/PostSerializer';

export class PostViewSet extends ModelViewSet<Post, typeof PostSerializer> {
    constructor() {
        super({
            serializer: PostSerializer,
            orderingFields: ['createdAt'],
            paginatorFactory: (queryset) => new CursorPaginator(queryset, 25, 'createdAt'),
        });
    }
}
```

In this example, blog posts are traversed by `createdAt`. Clients may request `ordering=createdAt` or `ordering=-createdAt`, and the paginator uses that same field to build the cursor boundary for the next request.

Keep the ordering contract narrow when you do this. Cursor pagination only remains clear when the public ordering choices line up with the field the cursor is actually using.

## Paginate a queryset directly when you are outside built-in list behavior

Some application code still needs pagination even though it is not running through the standard list endpoint of a viewset or generic view. A server-rendered page, a custom report endpoint, or a one-off internal tool may still need the same traversal contract.

In that case, instantiate the paginator directly, let it read the request query parameters, apply it to the queryset, and then return its response envelope.

```ts
import { TangoQueryParams } from '@danceroutine/tango-core';
import { OffsetPaginator } from '@danceroutine/tango-resources';
import { PostModel } from '@/models';

const baseQueryset = PostModel.objects.query().orderBy('-createdAt');
const paginator = new OffsetPaginator(baseQueryset, 20);
const params = TangoQueryParams.fromRequest(request);

paginator.parse(params);

const pagedQueryset = paginator.apply(baseQueryset);
const [page, totalCount] = await Promise.all([pagedQueryset.fetch(), baseQueryset.count()]);

return paginator.toResponse(page.results, { totalCount });
```

The pattern stays the same:

1. begin with the queryset in its final filtered and ordered form
2. let the paginator read the request parameters
3. apply the paginator to that queryset
4. fetch the page results
5. build the response from the paginator

That order keeps the pagination behavior consistent with the built-in resource layer.

## Verify the full pagination contract

A pagination test should do more than prove that the endpoint returns twenty rows. It should also prove that clients can move through the list predictably.

For offset pagination, verify that:

- the endpoint returns a deterministic order
- `next` and `previous` links advance through the list correctly
- filtered lists still return the expected count and links
- `page` and `offset` traversal produce the slices you expect

For cursor pagination, verify that:

- the cursor field matches the public ordering contract
- clients can follow `next` and `previous` links without constructing cursors themselves
- inserts or updates elsewhere in the list do not make traversal jump unpredictably

Those tests do more to protect the API contract than a single assertion about how many records appear in one response.

## Related pages

- [Build your API with viewsets](/how-to/build-your-api-with-viewsets)
- [Resources API reference](/reference/resources-api)
