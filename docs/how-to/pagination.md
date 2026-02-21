# How to add pagination

Tango ships with two paginators:

- `OffsetPaginator`
- `CursorPaginator`

Most applications should start with `OffsetPaginator` because it is already wired into `ModelViewSet` and `GenericAPIView`.

## Offset pagination

`OffsetPaginator` is the default paginator used by the built-in list behavior.

It reads:

- `limit`
- `offset`
- `page`

Then it returns a response envelope shaped like:

```json
{
    "count": 100,
    "next": "?limit=20&offset=20",
    "previous": null,
    "results": []
}
```

### With `ModelViewSet` or `GenericAPIView`

You do not need to instantiate the paginator yourself when you use the built-in list behavior. Those classes already create an `OffsetPaginator`, parse the request, apply it to the `QuerySet`, and serialize the response.

What you do need, regardless of whether the paginator is created manually or by a built-in view, is stable ordering.

Declare `orderingFields` in the resource config and give the underlying manager or query code a deterministic default order.

## Cursor pagination

`CursorPaginator` is intended for cases where forward traversal has to remain stable as data changes.

It reads:

- `limit`
- `cursor`
- `ordering`

The cursor token is opaque to the client. Internally it is a base64-encoded JSON payload with:

- version
- field
- direction
- value

Cursor pagination is useful when you need stable forward navigation over changing data, but it requires more care:

- pick a cursor field with stable ordering semantics
- avoid exposing arbitrary ordering when the cursor depends on one field
- document that clients should follow `next` and `previous` links instead of constructing cursors by hand

## A simple manual example

If you want to use a paginator outside the built-in views:

```ts
import { TangoQueryParams } from '@danceroutine/tango-core';
import { OffsetPaginator } from '@danceroutine/tango-resources';

const paginator = new OffsetPaginator(PostModel.objects.query());
const params = TangoQueryParams.fromRequest(request);

paginator.parse(params);

const qs = paginator.apply(PostModel.objects.query().orderBy('-createdAt'));
const [page, totalCount] = await Promise.all([qs.fetch(PostReadSchema), PostModel.objects.query().count()]);

return paginator.toResponse(page.results, { totalCount });
```

## Common mistakes

Avoid these:

- paginating without ordering
- exposing ordering on fields that are not safe or indexed
- mixing page-based and cursor-based conventions in one endpoint without documenting it clearly

## Related pages

- [Resources API reference](/reference/resources-api)
- [Filtering](/how-to/filtering)
