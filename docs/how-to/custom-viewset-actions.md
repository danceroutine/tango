# Define custom viewset actions

Use `ModelViewSet.defineViewSetActions(...)` when a resource needs extra collection or detail routes beyond the built-in CRUD surface.

## 1. Declare the action descriptors

Action descriptors live on the viewset as a static `actions` property.

```ts
import { ModelViewSet } from '@danceroutine/tango-resources';

export class PostViewSet extends ModelViewSet<Post, typeof PostSerializer> {
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

The helper preserves literal inference for `scope`, `methods`, and `path`, which keeps the action contract precise at compile time.

## 2. Implement the action methods

Each action name maps to an instance method on the viewset.

```ts
import { TangoResponse, type RequestContext } from '@danceroutine/tango-resources';

async publish(_ctx: RequestContext, id: string): Promise<TangoResponse> {
    const updated = await this.getSerializer().getManager().update(Number(id), {
        published: true,
        updatedAt: new Date().toISOString(),
    });

    return TangoResponse.json(this.getSerializer().toRepresentation(updated));
}
```

A detail action receives the resolved identifier as its second argument. A collection action only needs the request context.

## 3. Let the adapter register the routes

Adapters use the static action descriptors to register custom routes alongside the CRUD surface.

For a detail action named `publish`, the adapters register a route shaped like:

- Express: `POST /api/posts/:id/publish`
- Next.js App Router: `POST /api/posts/<id>/publish`

## 4. Keep the action contract resource-focused

Custom actions are a good fit for operations such as:

- publish
- archive
- resend invitation
- rotate token

They work best when the route describes a meaningful resource operation rather than a generic RPC bucket.

## Related pages

- [Resources and viewsets](/topics/resources-and-viewsets)
- [Serializers](/topics/serializers)
- [Resources API](/reference/resources-api)
