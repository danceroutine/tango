# Tutorial: build the Next.js blog

`examples/nextjs-blog` shows Tango inside a Next.js App Router project.

The point of the example is that the Tango application-facing layers stay recognizable even when the host runtime changes. Models, `Model.objects`, migrations, serializers, model hooks, and resources still follow the same patterns you use in the Express example.

## 1. Run the example

```bash
pnpm --filter @danceroutine/tango-example-nextjs-blog bootstrap
pnpm --filter @danceroutine/tango-example-nextjs-blog dev
```

Then open:

- `http://localhost:3001/`
- `http://localhost:3001/api/posts?limit=20&offset=0`
- `http://localhost:3001/api/openapi`

## 2. Read the model definition

The model module defines:

- `PostReadSchema`
- `PostCreateSchema`
- `PostModel`

It also imports `@danceroutine/tango-orm/runtime`, which is what enables `PostModel.objects` without separate runtime glue elsewhere in the app.

The model is also where the example keeps record lifecycle behavior such as slug generation and timestamp stamping. Those rules live in model hooks so they continue to run outside the API layer too.

## 3. Read the serializer

The serializer is the clearest place to see the resource contract.

Notice what it owns:

- create validation through `PostCreateSchema`
- update validation through `PostCreateSchema.partial()`
- output shaping through `PostReadSchema`
- request-scoped normalization before the manager call

That is the DRF-shaped piece of the example. Zod still defines the schemas, and the serializer gathers the HTTP-facing workflow around them.

## 4. Read the resource classes

The viewset handles the collection-style API, while the generic detail view handles retrieve, update, and delete for one post.

Two details are worth noticing:

1. `PostViewSet` delegates create and update behavior to the serializer instead of hand-rolling schema parsing in the route layer.
2. `PostViewSet` declares a custom `publish` action through `ModelViewSet.defineViewSetActions(...)`.

The App Router route files are also worth reading closely. `NextAdapter` owns the route-handler wiring while the viewset and generic view classes stay focused on resource behavior.

The example also includes a dedicated OpenAPI route. One module builds the document from resource instances, and the App Router route publishes it as JSON for external tooling.

## 5. Read the server-rendered pages

The page components still use `PostModel.objects` directly where that keeps the code straightforward.

The index page also uses `TangoQueryParams.fromRecord(...)` from `@danceroutine/tango-core`. That keeps page-level query parsing aligned with the same query contract resources use internally.

That gives the example a useful contrast:

- pages can query through `Model.objects` when they just need data
- resources use serializers and view classes when they need a public HTTP contract
- model hooks keep persistence rules aligned across both paths

## 6. Compare this example to the Express example

Both examples use the same Tango concepts:

- models
- `Model.objects`
- migrations
- serializers
- model hooks
- resource classes

The outer adapter layer is the part that changes, while the Tango application-facing core remains recognizable across both examples.

## 7. Make a small change

Try adding another searchable field or a new filter and trace the change through:

1. model and schema definition
2. model hooks if the field changes record lifecycle behavior
3. serializer contract if the API-facing shape changed
4. resource config
5. page query behavior if the server-rendered UI should expose the new field
6. migration scripts if the schema changed

That exercise will show you which parts of the stack stay fixed and which parts belong to the runtime adapter.

## What to read next

- [Serializers](/topics/serializers)
- [Model lifecycle hooks](/topics/model-lifecycle-hooks)
- [Resources and viewsets](/topics/resources-and-viewsets)
- [Filtering](/how-to/filtering)
- [Pagination](/how-to/pagination)
