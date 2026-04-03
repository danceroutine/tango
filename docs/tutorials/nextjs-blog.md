# Tutorial: build the Next.js blog

This tutorial walks through the Next.js example application in `examples/nextjs-blog`.

The purpose of the example is to show that Tango's application-facing layers still look familiar when the host framework changes. The server-rendered pages, route handlers, and App Router file structure all belong to Next.js. Under that surface, Tango still provides the model contract, `Model.objects`, migrations, serializers, and resource classes.

## What you are building

The example combines a public blog front end with a small API.

When it is running, you can:

- browse published posts at `/`
- open a server-rendered post detail page at `/posts/<slug>`
- call a viewset-backed API at `/api/posts`
- call a generic detail API at `/api/posts-generic/<id>`
- call a custom `APIView` at `/api/status`
- fetch an OpenAPI document at `/api/openapi`

That mixture is the point of the example. It shows that page rendering and API routes can both rely on the same Tango-backed model layer, while the API surface still gets serializers, viewsets, generic views, and OpenAPI generation.

## 1. Run the example

If you want to follow the tutorial exactly, work from a local clone of the Tango repository. The example application lives inside that workspace.

Start by applying the checked-in schema, seeding example data, and then running the Next.js development server:

```bash
pnpm --filter @danceroutine/tango-example-nextjs-blog setup:schema
pnpm --filter @danceroutine/tango-example-nextjs-blog bootstrap
pnpm --filter @danceroutine/tango-example-nextjs-blog dev
```

`setup:schema` applies the Tango migrations for the example. `bootstrap` seeds enough posts to make pagination, search, and published-state behavior worth exploring in the browser. `dev` starts the App Router application and, through its `predev` hook, makes sure the schema is applied before the server begins handling requests.

Once the app is running, open a few URLs:

- `http://localhost:3001/`
- `http://localhost:3001/?search=tango&limit=20&offset=0`
- `http://localhost:3001/api/posts?published=true&limit=20&offset=0`
- `http://localhost:3001/api/openapi`

The front page shows server-rendered post listing through `PostModel.objects`. The API route shows the same data layer exposed through Tango resources. The OpenAPI route shows the API contract published from those resource instances.

## 2. Start with the shared model layer

Open `src/lib/models.ts`.

This file is the heart of the example because both the page layer and the API layer depend on it.

`PostReadSchema` describes the fully loaded post shape that server components and API responses can both rely on. `PostCreateSchema` describes what callers may submit when they create a post through the API. `PostModel` then adds the database-facing metadata Tango needs in order to treat the post as a real model: the primary key, the unique slug, and the defaults for `published`, `createdAt`, and `updatedAt`.

The model also owns two lifecycle hooks. `beforeCreate` generates a slug and timestamps when a post is first written. `beforeUpdate` refreshes `updatedAt` on later writes. That placement matters in this example because the same persistence rules need to hold whether a write comes from a route handler, a script, or any other code path that talks to `PostModel.objects`.

## 3. Read the server-rendered pages

Next, open `src/app/page.tsx`.

This file shows the simplest way Tango appears inside a Next.js page: the page queries the model manager directly. `PostModel.objects.query()` builds the published-post query, `TangoQueryParams.fromRecord(...)` parses incoming search parameters, and `OffsetPaginator` turns the result into a paginated listing for the front page.

This is worth studying carefully because it shows how direct Tango-powered data access can stay inside a server-rendered page. When a page simply needs data, using `Model.objects` directly is often the clearest option.

Then open `src/app/posts/[slug]/page.tsx`.

The detail page uses the same model layer again, this time filtering by `slug` and calling `fetchOne(PostReadSchema)`. That keeps the detail page aligned with the same post contract the API uses, while still letting the Next.js page remain an ordinary server component.

## 4. Read the serializer and resource classes

Once the page layer is clear, move to the API-facing side of the example.

Start with `src/serializers/PostSerializer.ts`. The file is small, which makes it easier to see how a `ModelSerializer` gathers the model, the create schema, the update schema, and the outward-facing read schema into one HTTP-facing contract.

Then open `src/viewsets/PostViewSet.ts`.

This class defines the collection and detail API surface for `/api/posts`. The serializer supplies the request and response contract. The `FilterSet` declares which list filters are allowed. `orderingFields` and `searchFields` declare which public list features the endpoint supports. The custom `publish` action shows where post-specific HTTP behavior belongs once the standard CRUD actions are no longer enough.

Next, open `src/views/PostDetailAPIView.ts`.

`src/views/PostDetailAPIView.ts` is the generic-view alternative. Instead of exposing the full viewset surface, it uses `RetrieveUpdateDestroyAPIView` for one detail-style API. That is useful when an endpoint needs a narrower shape than the collection-plus-detail pattern of a full viewset.

Finally, open `src/views/StatusAPIView.ts`. That file is the fully custom endpoint in the example, and it shows where `APIView` fits when the endpoint is not naturally a model-backed CRUD resource at all.

## 5. Read the route handlers

Now read the App Router route files in `src/app/api/`.

`src/app/api/posts/[[...tango]]/route.ts` is the route-handler entrypoint for the post viewset. `NextAdapter` takes the `PostViewSet` instance and exposes `GET`, `POST`, `PATCH`, `PUT`, and `DELETE` handlers for the App Router.

`src/app/api/posts-generic/[[...tango]]/route.ts` does the same thing for the generic detail view by calling `adaptGenericAPIView(...)`.

These files stay short because they only need to own the App Router integration point. The Tango resource classes continue to own the API behavior behind them.

## 6. Read the OpenAPI path

Open `src/lib/openapi.ts` and then `src/app/api/openapi/route.ts`.

`src/lib/openapi.ts` builds the OpenAPI document from the same viewset and view instances used elsewhere in the app. The route file then publishes that generated document as JSON.

Reading these two files together shows how the API description is derived from the Tango resources that already define the public API.

## 7. Exercise the running application

With the app still running, try a few requests and pages:

- `/?search=api&limit=20&offset=0`
- `/api/posts?published=true`
- `/api/posts?search=api`
- `/api/posts?q=api`
- `/api/posts?ordering=-createdAt`
- `/api/posts-generic/1`
- `/api/status`

These routes show the same Tango pieces from different angles. The front page uses model queries and pagination directly. The API routes use serializers and resource classes. The status endpoint shows the custom `APIView` path. The OpenAPI route describes all of them for tooling.

## 8. Make one small change

Once the example feels familiar, add one new field so you can watch the change move through the stack.

A good exercise is to add an optional `subtitle` field for posts.

That change will take you through the same layers this tutorial introduced:

1. add `subtitle` to the post schemas in `src/lib/models.ts`
2. include it in the model metadata so Tango knows it belongs in the stored schema
3. generate and apply a migration
4. let `PostSerializer` pick up the new schema contract
5. decide whether the API should search, filter, or order on the new field
6. update the server-rendered pages if the UI should display it

Generate and apply the migration with:

```bash
pnpm --filter @danceroutine/tango-example-nextjs-blog make:migrations --name add_subtitle
pnpm --filter @danceroutine/tango-example-nextjs-blog setup:schema
```

After that, reload the pages and API routes and confirm that the new field behaves the way you expect.

## What to read next

- [Models and schema](/topics/models-and-schema)
- [API layer](/topics/api-layer)
- [Migrations](/topics/migrations)
- [How to work with serializers](/how-to/working-with-serializers)
- [How to build your API with viewsets](/how-to/build-your-api-with-viewsets)
