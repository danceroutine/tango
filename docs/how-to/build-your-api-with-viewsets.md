# How to build your API with viewsets

Most APIs begin with the same baseline capability: create, retrieve, update, and delete one record at a time.

The next step is usually collection-level behavior. A resource often needs to list many records, filter them, order them, paginate them, and sometimes expose resource-specific operations that do not fit neatly into plain CRUD.

When those item-level and collection-level concerns belong to the same resource, it is usually easier to keep that HTTP behavior in one class. In Tango, `ModelViewSet` is the class for that job.

Suppose you are building a blog post API. The viewset is where you decide how clients list posts, retrieve one post, create posts, update posts, delete posts, and invoke post-specific operations such as publish.

At this stage, the main goal is simple: keep the HTTP behavior for the blog post resource together in one place instead of scattering it across unrelated route handlers.

If you are coming from a more traditional Express or Next.js codebase, the viewset takes the place of the cluster of route handlers that would otherwise all coordinate around the same resource.

The examples below assume you already have the supporting Tango classes for blog posts in place, including a serializer, which validates request data and shapes responses, and a model, which handles database reads and writes. If you need the serializer first, start with [How to work with serializers](/how-to/working-with-serializers). The examples here stay on the viewset layer.

## Start with the built-in CRUD surface

Begin with a minimal viewset class that points at that serializer and defines the list behavior you want to make public.

```ts
import { ModelViewSet } from '@danceroutine/tango-resources';
import type { Post } from '@/models';
import { PostSerializer } from '@/serializers/PostSerializer';

export class PostViewSet extends ModelViewSet<Post, typeof PostSerializer> {
    constructor() {
        super({
            serializer: PostSerializer,
            orderingFields: ['id', 'createdAt', 'updatedAt', 'title'],
        });
    }
}
```

That class already gives the resource a standard CRUD surface. `orderingFields` controls which fields clients may use through the `ordering` query parameter, such as `ordering=-createdAt` when the newest posts should appear first.

After you connect the viewset to Express or Next.js through an adapter, Tango will dispatch these route-level operations through the class:

- collection `GET` to list records
- collection `POST` to create a record
- detail `GET` to retrieve one record
- detail `PATCH` and `PUT` to update one record
- detail `DELETE` to remove one record

In the simplest case, you do not implement those CRUD methods yourself. The base class already provides them, and the serializer supplies the validation and representation contract they rely on.

The adapter decides how those routes are attached to the host framework, but the viewset is the class that owns the resource contract.

### Register the viewset with an adapter

In Express, register the viewset against a base path:

```ts
import express from 'express';
import { ExpressAdapter } from '@danceroutine/tango-adapters-express';
import { PostViewSet } from './viewsets/PostViewSet';

const app = express();
app.use(express.json());

const adapter = new ExpressAdapter();
adapter.registerViewSet(app, '/api/posts', new PostViewSet());
```

That one registration call gives the resource both collection and detail routes under `/api/posts`.

In the Next.js App Router, create `app/api/posts/[[...tango]]/route.ts` and export the HTTP handlers from that route file:

```ts
import { NextAdapter } from '@danceroutine/tango-adapters-next';
import { PostViewSet } from '@/viewsets/PostViewSet';

const adapter = new NextAdapter();

export const { GET, POST, PATCH, PUT, DELETE } = adapter.adaptViewSet(new PostViewSet());
```

The `[[...tango]]` catch-all segment lets the adapter handle both `/api/posts` and `/api/posts/123` through the same viewset instance.

## Add filtering to the list endpoint

Once the CRUD surface is in place, the next question is usually which query parameters the posts list should accept. Filtering decides which records are eligible to appear in the list response. Pagination answers a different question, namely how a client moves through that result set. It is usually easier to define the filtering contract first, test that the eligible rows are correct, and then add pagination once the list semantics are stable.

### Start with an explicit filter contract

`FilterSet.define(...)` starts from an allowlist. A query parameter only becomes part of the API when you declare it, which means the public list contract stays deliberate and reviewable.

```ts
import { FilterSet } from '@danceroutine/tango-resources';
import type { Post } from '@/models';

export const postFilters = FilterSet.define<Post>({
    fields: {
        authorId: true,
        published: true,
        id: ['exact', 'in'],
        createdAt: ['gte', 'lte'],
    },
    aliases: {
        q: { fields: ['title', 'content'], lookup: 'icontains' },
        created_after: { field: 'createdAt', lookup: 'gte' },
        created_before: { field: 'createdAt', lookup: 'lte' },
    },
});
```

Suppose the blog post list should let clients narrow the results by author, publication state, and creation date, while also exposing one text-style parameter for title and content. The filter set above expresses that contract directly:

- `authorId=42` and `published=true` perform exact matching
- `id__in=1,2,3` or repeated `id__in` parameters perform set membership
- `createdAt__gte=2026-01-01` and `createdAt__lte=2026-12-31` expose range comparisons on the field name itself
- `created_after=2026-01-01` and `created_before=2026-12-31` give the same date range a more readable public shape
- `q=tango` searches across both `title` and `content`

In practice, most list endpoints only need a small set of filter shapes: exact matching for ids or booleans, range comparisons for dates and numbers, and one or two text-style parameters. Start with the smallest contract that makes the list useful, then add more shapes only when the endpoint truly needs them.

### Attach the filter set to the viewset

Once the filter contract looks right, attach it to the same viewset. At that point the class looks like this:

```ts
export class PostViewSet extends ModelViewSet<Post, typeof PostSerializer> {
    constructor() {
        super({
            serializer: PostSerializer,
            filters: postFilters,
            orderingFields: ['id', 'createdAt', 'updatedAt', 'title'],
        });
    }
}
```

At request time, the viewset reads the query string, applies the declared filter set, applies any allowed ordering rules, and then paginates the result. A request such as `/api/posts?published=true&authorId=42&created_after=2026-01-01&ordering=-createdAt` now has one clear place in application code where that list behavior is defined.

If you want Tango's built-in `search` query parameter as well, add `searchFields` alongside `filters` in the same constructor. `searchFields` accepts relation paths too, so a blog resource can search over direct columns such as `title` and related columns such as `tags__name` through one declarative list-search contract.

### Add parser hooks when the public parameter needs them

Add an explicit parser when the public parameter no longer maps cleanly onto the stored field type.

`parse` receives either one query-string value or an array of repeated values. Return the parsed value when the filter should be applied. Return `undefined` when the parameter should be ignored.

```ts
const postFilters = FilterSet.define<Post>({
    aliases: {
        publication_state: {
            field: 'published',
            parse: (raw) => {
                const value = Array.isArray(raw) ? raw[0] : raw;
                if (value === 'live') return true;
                if (value === 'draft') return false;
                return undefined;
            },
        },
    },
});
```

That keeps the external API readable while leaving the stored field name and the model property unchanged.

Many model-backed viewsets can stop without explicit parser hooks. Tango can infer common parsers from model metadata for exact, range, and `in` filters on booleans, integers, big integers, and timestamps. That covers many everyday cases such as `published=true`, `id__in=1,2,3`, or `created_after=2026-01-01`.

### Keep permissive filtering rare

`FilterSet` also supports `all: '__all__'`, which turns unknown query parameters into filters automatically. That is most useful for internal tools, admin-style surfaces, and debugging endpoints where flexibility matters more than a tightly documented public API.

Application-facing endpoints usually benefit from the explicit allowlist style shown above, because it makes the list contract easier to explain, test, and evolve.

## Add custom actions when CRUD is not enough

The built-in CRUD surface covers the standard resource lifecycle. The next question is whether the resource needs any operations that still belong to blog posts, but do not fit cleanly into list, retrieve, create, update, or destroy.

Publishing a post, archiving a record, rotating a token, or triggering a reindex job are all examples of resource-specific operations that belong naturally on the viewset.

### Declare the action descriptors

Action descriptors live on the class as a static `actions` property. For the blog post resource, `publish` is a detail action because it acts on one post, while `reindex` is a collection action because it acts on the posts collection as a whole. Add those descriptors to the same `PostViewSet` class:

```ts
export class PostViewSet extends ModelViewSet<Post, typeof PostSerializer> {
    // ...
    static readonly actions = ModelViewSet.defineViewSetActions([
        {
            name: 'publish',
            scope: 'detail',
            methods: ['POST'],
            path: 'publish',
        },
        {
            name: 'reindex',
            scope: 'collection',
            methods: ['POST'],
            path: 'reindex',
        },
    ]);
}
```

Each descriptor names the method the adapter should call, tells Tango whether the route belongs to one record or to the collection as a whole, declares the allowed HTTP methods, and chooses the path segment that should be appended to the resource route.

### Implement the action methods

Each action descriptor must have a matching instance method on the viewset. Stay in the same class and add the handlers that implement those operations.

```ts
import { TangoResponse } from '@danceroutine/tango-core';
import type { RequestContext } from '@danceroutine/tango-resources';
import { PostModel } from '@/models';

export class PostViewSet extends ModelViewSet<Post, typeof PostSerializer> {
    // ...
    async publish(_ctx: RequestContext, id: string): Promise<TangoResponse> {
        const updated = await PostModel.objects.update(Number(id), {
            published: true,
        });

        return TangoResponse.json(await this.getSerializer().serialize(updated));
    }

    async reindex(_ctx: RequestContext): Promise<TangoResponse> {
        return TangoResponse.json({ queued: true }, { status: 202 });
    }
}
```

A detail action receives the resolved identifier as its second argument. A collection action only receives the request context, because there is no single record id in that route shape.

Once the adapter registers the viewset, these descriptors turn into additional routes next to the CRUD surface. In Express, the example above adds `POST /api/posts/:id/publish` and `POST /api/posts/reindex`. In the Next.js App Router, the same descriptors add `POST /api/posts/<id>/publish` and `POST /api/posts/reindex`.

Custom actions work best when the route still describes a meaningful resource operation. If the behavior no longer feels like it belongs to the resource, that is often a sign that it should live in a different endpoint or a different abstraction.

## Add pagination after the list contract is clear

Once the list endpoint returns the right records in the right order, the remaining question is how clients should move through that list. That is where pagination begins.

Filtering and pagination usually work best in that sequence. First decide which records belong in the list. Then decide how clients traverse that ordered result set.

Tango already uses `OffsetPaginator` for the built-in list behavior on `ModelViewSet`, so many resources do not need any additional pagination code at this stage.

Continue with [How to add pagination](/how-to/pagination) when you want to understand the default response envelope, switch the resource to cursor pagination, or paginate a queryset outside the built-in list behavior.

## Related pages

- [How to work with serializers](/how-to/working-with-serializers)
- [How to add pagination](/how-to/pagination)
- [API layer](/topics/api-layer)
- [Resources API reference](/reference/resources-api)
