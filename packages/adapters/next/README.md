# @danceroutine/tango-adapters-next

`@danceroutine/tango-adapters-next` runs Tango views and viewsets inside Next.js App Router route handlers.

Tango supplies the application-layer concepts such as serializers, API views, and model-backed viewsets. Next.js still owns routing, deployment model, and the route-handler contract. This package exists to connect those layers cleanly so that a Tango API can live inside a Next.js codebase without forcing the resource layer to become Next-specific.

## Install

```bash
pnpm add @danceroutine/tango-adapters-next next react react-dom
```

In practice, you will pair this package with Tango schema, ORM, and resources packages.

## How it fits into a Next.js application

A typical workflow looks like this:

1. define models with `@danceroutine/tango-schema`
2. query and mutate data through `Model.objects` from `@danceroutine/tango-orm`
3. expose that model-backed behavior through Tango views or viewsets
4. adapt those handlers to App Router route files with `NextAdapter`

This adapter is concerned solely with step 4 of the above workflow. It receives Next's request and route context, invokes the Tango handler, and returns a response in the shape Next expects.

## Quick start

```ts
import { NextAdapter } from '@danceroutine/tango-adapters-next';
import { TodoViewSet } from '@/viewsets/TodoViewSet';

const adapter = new NextAdapter();
const viewset = new TodoViewSet();

export const { GET, POST, PATCH, PUT, DELETE } = adapter.adaptViewSet(viewset);
```

Place that code in `app/api/todos/[[...tango]]/route.ts`. The adapter will produce handlers for the collection route at `/api/todos` and the detail route at `/api/todos/:id`.

Use `adaptViewSet(...)` when you already have a ready viewset instance in hand. Use `adaptViewSetFactory(...)` when constructing the viewset requires asynchronous setup. The factory result is memoized inside the adapter, and initialization failures clear that memoized promise so a later request can retry cleanly.

For detail requests, the adapter resolves the identifier, passes it as the second argument to `retrieve`, `update`, and `destroy`, and also populates `ctx.params.id`.

`NextAdapter` also exposes `toQueryParams(searchParams)` for route modules and server components that want the same normalized query contract resources use internally. That helper returns `TangoQueryParams` from `@danceroutine/tango-core`.

If one resource should treat each write request as a single database unit of work, pass the adapter's writes-only transaction mode when you adapt the viewset:

```ts
export const { GET, POST, PATCH, PUT, DELETE } = adapter.adaptViewSet(viewset, {
    transaction: 'writes',
});
```

That option wraps `POST`, `PUT`, `PATCH`, and `DELETE` requests in one `transaction.atomic(...)` boundary. `GET`, `HEAD`, and `OPTIONS` stay outside the wrapper. The current adapter transaction mode uses the Tango runtime your application installs as its default runtime.

## Public API

The root export includes:

- `NextAdapter`, the main integration class
- `AdaptNextOptions` and `AdaptNextViewSetOptions`
- route-facing helper types such as `NextAPIView`, `NextCrudViewSet`, `NextRouteHandler`, and `NextViewSetRouteHandlers`

The main adapter entry points are:

- `adaptViewSet(...)` for an already constructed viewset
- `adaptViewSetFactory(...)` for lazy async viewset construction in App Router route modules
- `adaptAPIView(...)` for `APIView`
- `adaptGenericAPIView(...)` for `GenericAPIView`-style collection/detail dispatch

You can import from the package root or from the `adapter` subpath:

```ts
import { NextAdapter } from '@danceroutine/tango-adapters-next';
import { adapter } from '@danceroutine/tango-adapters-next';
```

## Documentation

- Official documentation: <https://tangowebframework.dev>
- Next.js blog tutorial: <https://tangowebframework.dev/tutorials/nextjs-blog>
- API layer topic: <https://tangowebframework.dev/topics/api-layer>

## Development

```bash
pnpm --filter @danceroutine/tango-adapters-next build
pnpm --filter @danceroutine/tango-adapters-next typecheck
pnpm --filter @danceroutine/tango-adapters-next test
```

For the wider contributor workflow, use:

- <https://tangowebframework.dev/contributors/contributing-code>

## License

MIT
