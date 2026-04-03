# Tutorial: build the Nuxt blog

This tutorial walks through the Nuxt example application in `examples/nuxt-blog`.

The example is useful because it shows Tango inside a host framework with a different integration shape from Express and Next.js. Nuxt owns the page layer and Nitro owns the server-handler layer, while Tango still provides the model contract, `Model.objects`, migrations, serializers, and resource classes underneath.

## What you are building

The example combines server-rendered blog pages with a small API surface.

When it is running, you can:

- browse published posts at `/`
- open a server-rendered detail page at `/posts/<slug>`
- call a viewset-backed API at `/api/posts`
- call a generic detail API at `/api/posts-generic/<id>`
- call a custom `APIView` at `/api/status`
- fetch an OpenAPI document at `/api/openapi`

That combination is the point of the tutorial. It shows how Tango can power the data and API layers inside a Nuxt application without changing the way Nuxt pages and Nitro handlers are meant to work.

## 1. Run the example

If you want to follow the tutorial exactly, work from a local clone of the Tango repository. The example application lives inside that workspace.

Start by bootstrapping the example data and then running the Nuxt development server:

```bash
pnpm --filter @danceroutine/tango-example-nuxt-blog bootstrap
pnpm --filter @danceroutine/tango-example-nuxt-blog dev
```

Both scripts do a little more than their names suggest. The Nuxt example uses source-linked workspace packages, so its script chain first runs `prepare:tango` to build the Tango packages the app depends on. After that, the example applies the schema and seeds the SQLite database before the Nuxt server starts.

Once the app is running, open a few URLs:

- `http://localhost:3002/`
- `http://localhost:3002/api/posts?limit=20&offset=0`
- `http://localhost:3002/api/status`
- `http://localhost:3002/api/openapi`

The front page shows the SSR side of the example. The post API shows the Tango resource layer exposed through Nitro handlers. The status endpoint shows the custom API-view path. The OpenAPI route shows the generated API contract published as JSON.

## 2. Start with the Nuxt integration seam

Open `nuxt.config.ts`.

This is the clearest place to begin because it shows exactly where Tango meets Nuxt.

Nuxt still owns the application shell, the page layer, and server rendering. The Tango-specific part of the integration happens in the `serverHandlers` list, where Nitro routes such as `/api/posts`, `/api/posts-generic`, `/api/status`, and `/api/openapi` are mapped to explicit handler files under `server/tango/`.

That is the core Nuxt pattern in this example: Nuxt and Nitro own the framework entrypoints, while Tango supplies the resource behavior those handlers delegate to.

## 3. Read the shared model layer

Next, open `lib/models.ts`.

This file plays the same central role as the shared model module in the Next.js example. The SSR pages and the API handlers both depend on it.

`PostReadSchema` describes the fully loaded post shape that both the page layer and the API layer can rely on. `PostCreateSchema` describes what the API may accept on create. `PostModel` adds the database-facing metadata Tango needs in order to treat the post as a real model, including the primary key, the unique slug, and the defaults for `published`, `createdAt`, and `updatedAt`.

This file also includes one Nuxt-specific detail: `registerModelObjects()`. In this example, the app is wired directly against workspace source, and Nuxt or Nitro can tree-shake side-effect-only runtime imports. Calling `registerModelObjects()` here keeps `PostModel.objects` available in SSR pages and Nitro handlers.

The model also owns the lifecycle hooks for slug generation and timestamp stamping. That keeps those persistence rules aligned no matter which part of the application writes the post.

## 4. Read the server-rendered pages

After the model layer is clear, open `app/pages/index.server.vue`.

`app/pages/index.server.vue` shows how Tango appears inside a Nuxt SSR page when the page simply needs data. It uses `PostModel.objects.query()` to build the base query, `toNuxtQueryParams(...)` to turn the incoming route query into Tango-style query params, and `OffsetPaginator` to produce a paginated published-post listing.

Then open `app/pages/posts/[slug].server.vue`.

The detail page uses the same model layer again, this time filtering by `slug` and calling `fetchOne(PostReadSchema)`. That keeps the page aligned with the same post contract the API uses, while still leaving the page as an ordinary Nuxt SSR component.

These two pages show how direct data access can stay in the Nuxt page layer. When a page simply needs data, direct `Model.objects` usage is often the clearest path.

## 5. Read the serializer and resource classes

Now move to the API-facing side of the example.

Start with `serializers/PostSerializer.ts`. The serializer gathers the model, the create schema, the update schema, and the outward-facing read schema into one HTTP-facing contract.

Then open `viewsets/PostViewSet.ts`.

This class defines the collection and detail API surface for `/api/posts`. The serializer supplies the request and response contract. The `FilterSet` declares the allowed list filters, including `published` and `slug`. `orderingFields` and `searchFields` declare which list features the endpoint supports. The `publish` action shows where resource-specific HTTP behavior belongs once the standard CRUD actions are no longer enough.

After that, open `views/PostDetailAPIView.ts` and `views/StatusAPIView.ts`.

`PostDetailAPIView` shows the generic-view path for retrieve, update, and delete on one post. `StatusAPIView` shows the fully custom endpoint path for a handler that is not naturally a model-backed CRUD resource.

## 6. Read the Nitro handlers and OpenAPI path

Now open the files under `server/tango/`.

`server/tango/posts.ts` adapts the post viewset into a Nitro handler with `NuxtAdapter`. `server/tango/posts-generic.ts` does the same thing for the generic detail view. `server/tango/status.ts` adapts the custom API view.

These files stay short because they only need to own the Nitro integration point. The Tango resource classes continue to own the API behavior behind them.

Then read `lib/openapi.ts` and `server/tango/openapi.ts`.

`lib/openapi.ts` builds the OpenAPI document from the same Tango resources used elsewhere in the app. `server/tango/openapi.ts` publishes that generated document through Nitro.

Reading those files together shows how the API description is derived from the resource layer.

## 7. Exercise the running application

With the app still running, try a few routes:

- `/`
- `/?search=api&limit=20&offset=0`
- `/api/posts?published=true`
- `/api/posts?slug=<slug-from-the-front-page>`
- `/api/posts?q=api`
- `/api/posts?ordering=-createdAt`
- `/api/posts-generic/1`
- `/api/status`

These routes let you see the same Tango pieces from different directions. The SSR pages query through `Model.objects`. The API routes use serializers and resource classes. The status route uses a custom `APIView`. The OpenAPI route describes all of them for tooling.

## 8. Make one small change

Once the example feels familiar, add one new field so you can watch the change move through the stack.

A good exercise is to add an optional `subtitle` field for posts.

That change will take you through the same layers this tutorial introduced:

1. add `subtitle` to the post schemas in `lib/models.ts`
2. include it in the model metadata so Tango knows it belongs in the stored schema
3. generate and apply a migration
4. let `PostSerializer` pick up the new schema contract
5. decide whether the API should filter, search, or order on the new field
6. update the Nuxt SSR pages if the UI should display it

Generate and apply the migration with:

```bash
pnpm --filter @danceroutine/tango-example-nuxt-blog make:migrations --name add_subtitle
pnpm --filter @danceroutine/tango-example-nuxt-blog setup:schema
```

After that, reload the pages and API routes and confirm that the new field behaves the way you expect.

## What to read next

- [Next.js blog tutorial](/tutorials/nextjs-blog)
- [Models and schema](/topics/models-and-schema)
- [API layer](/topics/api-layer)
- [Auto-document your API](/how-to/auto-document-your-api)
