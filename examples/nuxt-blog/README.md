# Nuxt Blog Example (Nuxt 4 + SQLite)

This example shows Tango inside a Nuxt 4 application through explicit Nitro server handlers. Nuxt still owns the application shell and SSR pages, while Tango provides model metadata, `Model.objects`, migrations, serializers, viewsets, generic API views, and OpenAPI generation underneath.

## Quick start

```bash
pnpm --filter @danceroutine/tango-example-nuxt-blog bootstrap
pnpm --filter @danceroutine/tango-example-nuxt-blog dev
```

`bootstrap` prepares the Tango workspace packages, applies the checked-in migrations, and seeds users, posts, and comments so list pages, detail pages, and nested relation hydration are worth exploring immediately.

When you change model metadata, use:

```bash
pnpm --filter @danceroutine/tango-example-nuxt-blog run make:migrations -- --name add_field
```

That workflow generates the migration and refreshes the generated relation registry at the same time. If you only changed relation metadata and do not need a new migration file, run:

```bash
pnpm --filter @danceroutine/tango-example-nuxt-blog codegen:relations
```

The same Tango primitives still drive the app:

- model metadata
- `Model.objects`
- migrations
- serializers
- viewsets and generic API views
- OpenAPI generation

## Useful URLs

- `/`
- `/api/editorial/overview?limit=3`
- `/api/posts?limit=20&offset=0`
- `/api/openapi`
- `/api/status`
- `/posts/<slug>`

When the app is running, you can also open:

- `http://localhost:3002/`
- `http://localhost:3002/api/posts?limit=20&offset=0`
- `http://localhost:3002/api/openapi`

## What this example shows

This example uses the same three-model relation graph as the Express blog API example and pushes it through three consumers:

- Nuxt SSR pages that query `PostModel.objects` directly
- Nitro handlers that expose Tango resources
- an editorial overview endpoint that returns nested hydrated rows over HTTP

The relation graph is:

- `Post.author`
- `User.posts`
- `Post.comments`
- `Comment.author`

The index page uses `selectRelated('author')`, the post detail page uses `selectRelated('author').prefetchRelated('comments__author')`, and `GET /api/editorial/overview` exposes the same nested graph through a Nitro-backed APIView. That makes the example useful both for Nuxt adapter wiring and for real nested traversal with generated path typing.

## A good reading path through the example

1. `nuxt.config.ts` for the explicit Tango Nitro server-handler registration
2. `lib/models.ts` for the shared user, post, and comment contract plus explicit ORM registration
3. `serializers/` for the API-facing contract
4. `views/EditorialOverviewAPIView.ts` for the HTTP-facing nested hydration example
5. `viewsets/` and `views/` for the rest of the resource behavior
6. `server/tango/` for the Nuxt adapter-backed Nitro handlers
7. `app/pages/` for the server-rendered UI
8. `scripts/bootstrap.ts` for seed data setup

## Project layout

- `nuxt.config.ts` registers the explicit Tango Nitro server handlers
- `app/pages/` contains the Nuxt SSR pages
- `server/tango/` contains Tango adapter-backed Nitro handlers
- `lib/models.ts` defines the relation graph and explicitly registers `Model.objects` for the Nuxt/Nitro runtime
- `.tango/` generated relation typing artifacts after `make:migrations` or `codegen:relations`
- `serializers/` defines the API-facing contract
- `viewsets/` and `views/` define resource behavior
- `views/EditorialOverviewAPIView.ts` exposes nested relation hydration over HTTP
- `server/tango/editorial-overview.ts` wires the editorial overview endpoint into Nitro
- `scripts/bootstrap.ts` seeds the SQLite demo database
