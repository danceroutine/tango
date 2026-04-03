# @danceroutine/tango-adapters-nuxt

`@danceroutine/tango-adapters-nuxt` runs Tango views and viewsets inside Nuxt Nitro event handlers.

Nuxt still owns pages, layouts, SSR rendering, and deployment model concerns. This package exists to connect Nitro's event-handler contract to Tango's framework-agnostic resource layer cleanly, so a Tango API can live inside a Nuxt codebase without forcing the resource layer to become Nuxt-specific.

## Install

```bash
pnpm add @danceroutine/tango-adapters-nuxt nuxt vue
```

In practice, you will pair this package with Tango schema, ORM, and resources packages.

## How it fits into a Nuxt application

A typical Tango + Nuxt stack looks like this:

1. define models with `@danceroutine/tango-schema`
2. query and mutate data through `Model.objects` from `@danceroutine/tango-orm`
3. expose that model-backed behavior through Tango views or viewsets
4. adapt those handlers to Nitro event handlers with `NuxtAdapter`
5. register those handlers explicitly through `serverHandlers` in `nuxt.config.ts`

This package is concerned solely with steps 4 and 5. It receives Nuxt Nitro events, invokes the Tango handler, and returns a response in the shape Nitro expects.

## Quick start

```ts
import { NuxtAdapter } from '@danceroutine/tango-adapters-nuxt';
import { TodoViewSet } from '~/viewsets/TodoViewSet';

const adapter = new NuxtAdapter();

export default adapter.adaptViewSet(new TodoViewSet());
```

Then register that handler in `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
    serverHandlers: [
        { route: '/api/todos', handler: './server/tango/todos.ts' },
        { route: '/api/todos/**:tango', handler: './server/tango/todos.ts' },
    ],
});
```

That gives the adapter one handler for the collection route at `/api/todos` and the catch-all detail and custom-action routes under `/api/todos/**`.

Use `adaptViewSet(...)` when you already have a ready viewset instance in hand. Use `adaptViewSetFactory(...)` when constructing the viewset requires asynchronous setup. The factory result is memoized inside the adapter, and initialization failures clear that memoized promise so a later request can retry cleanly.

## Public API

The root export includes:

- `NuxtAdapter`, the main integration class
- `AdaptNuxtOptions` and `AdaptNuxtViewSetOptions`
- route-facing helper types such as `NuxtAPIView`, `NuxtCrudViewSet`, `NuxtEventHandler`, and `NuxtViewSetFactory`

The main adapter entry points are:

- `adaptViewSet(...)` for an already constructed viewset
- `adaptViewSetFactory(...)` for lazy async viewset construction
- `adaptAPIView(...)` for `APIView`
- `adaptGenericAPIView(...)` for `GenericAPIView`-style collection/detail dispatch
- `adaptGenericAPIViewFactory(...)` for lazy generic API view construction

`NuxtAdapter` also exposes `toQueryParams(...)` for application code that wants the same normalized query contract resources use internally.

## Documentation

- Official documentation: <https://tangowebframework.dev>
- Nuxt blog tutorial: <https://tangowebframework.dev/tutorials/nuxt-blog>
- API layer topic: <https://tangowebframework.dev/topics/api-layer>

## Development

```bash
pnpm --filter @danceroutine/tango-adapters-nuxt build
pnpm --filter @danceroutine/tango-adapters-nuxt typecheck
pnpm --filter @danceroutine/tango-adapters-nuxt test
```

## License

MIT
