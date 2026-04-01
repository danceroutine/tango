# Tutorial: build the Nuxt blog

`examples/nuxt-blog` shows Tango running inside a Nuxt 4 application through explicit Nitro server handlers.

The point of the example is the same as the Next.js tutorial: the Tango application-facing layers stay recognizable even when the host runtime changes. Models, `Model.objects`, migrations, serializers, model hooks, and resources still follow the same patterns you use in the Express and Next examples.

## 1. Run the example

```bash
pnpm --filter @danceroutine/tango-example-nuxt-blog bootstrap
pnpm --filter @danceroutine/tango-example-nuxt-blog dev
```

Then open:

- `http://localhost:3002/`
- `http://localhost:3002/api/posts?limit=20&offset=0`
- `http://localhost:3002/api/openapi`

## 2. Start at the Nuxt integration seam

Read `nuxt.config.ts` first.

That file shows the Nuxt v1 integration model directly:

1. Nuxt owns the app shell, pages, and SSR rendering.
2. Tango-backed API handlers are mounted explicitly through Nitro `serverHandlers`.
3. Each mounted handler delegates to `NuxtAdapter`.

This is intentionally adapter-first. The Nuxt integration does not hide route mounting behind a module abstraction yet.

## 3. Read the model definition

The model module defines:

- `PostReadSchema`
- `PostCreateSchema`
- `PostModel`

It also calls `registerModelObjects()` from `@danceroutine/tango-orm/runtime`. Nuxt and Nitro can drop side-effect-only imports when the app is wired directly against workspace source, so the explicit registration keeps `PostModel.objects` available in both SSR pages and Tango-backed handlers.

The example keeps slug generation and timestamp stamping in model hooks so they continue to apply outside the API layer too.

## 4. Read the serializer

The serializer owns the HTTP-facing contract:

- create validation through `PostCreateSchema`
- update validation through `PostCreateSchema.partial()`
- output shaping through `PostReadSchema`

That keeps the resource layer explicit while still reusing the same Zod contracts the page and model layers rely on.

## 5. Read the resource classes

The example uses three resource styles:

- `PostViewSet` for CRUD and a custom `publish` action
- `PostDetailAPIView` for a generic detail retrieve/update/delete example
- `StatusAPIView` for a small non-model endpoint

The viewset and API view classes stay focused on resource behavior. `NuxtAdapter` is the only place that needs to care about Nitro request handling.

## 6. Read the Nitro handler files

The `server/tango/` directory is the core Nuxt integration layer.

Each file does one small job:

- construct `NuxtAdapter`
- instantiate the resource
- export the adapted Nitro handler

That keeps the adapter surface explicit and easy to debug. The Nuxt runtime sees normal Nitro handlers, while Tango still sees resource classes and `RequestContext`.

## 7. Read the SSR pages

The pages under `app/pages/` still query through `PostModel.objects` directly where that keeps the code straightforward.

That gives the example the same contrast as the Next.js tutorial:

- pages can query through `Model.objects` when they just need data
- resources use serializers and view classes when they need a public HTTP contract
- model hooks keep persistence rules aligned across both paths

## 8. Make one small change

Try adding a `summary` field to the post schemas and model metadata, then generate and apply a migration:

```bash
pnpm --filter @danceroutine/tango-example-nuxt-blog make:migrations --name add_summary
pnpm --filter @danceroutine/tango-example-nuxt-blog setup:schema
```

Then update:

1. the model definition
2. the serializer contract
3. any resource behavior that should expose the new field
4. the Nuxt page rendering if the field should appear in the UI

That exercise shows where Tango-specific behavior stops and where Nuxt-specific rendering begins.

## What to read next

- [Next.js blog tutorial](/tutorials/nextjs-blog)
- [Resources and viewsets](/topics/resources-and-viewsets)
- [Serializers](/topics/serializers)
- [Model lifecycle hooks](/topics/model-lifecycle-hooks)
- [Publish an OpenAPI document](/how-to/publish-openapi-document)
