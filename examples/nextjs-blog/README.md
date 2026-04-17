# Next.js Blog Example (App Router + SQLite)

This example shows Tango inside a Next.js App Router project. Server components still render pages, route handlers still own HTTP endpoints, and Tango provides model metadata, `Model.objects`, migrations, serializers, model hooks, and resource behavior underneath.

## Quick start

```bash
pnpm --filter @danceroutine/tango-example-nextjs-blog setup:schema
pnpm --filter @danceroutine/tango-example-nextjs-blog bootstrap
pnpm --filter @danceroutine/tango-example-nextjs-blog dev
```

`setup:schema` applies the checked-in Tango migrations. `bootstrap` seeds users, posts, and comments so pagination, detail pages, and nested relation hydration are worth exploring immediately.

When you change model metadata, use:

```bash
pnpm --filter @danceroutine/tango-example-nextjs-blog make:migrations --name add_field
```

That workflow generates the migration and refreshes the generated relation registry at the same time. If you only changed relation metadata and do not need a new migration file, run:

```bash
pnpm --filter @danceroutine/tango-example-nextjs-blog codegen:relations
```

Optional environment variables:

- `TANGO_SQLITE_FILENAME` (default: `./.data/nextjs-blog.sqlite`)
- `SEED_POSTS_COUNT` (default: `1000`)

## Useful URLs

- `/` (paginated published posts)
- `/?search=tango&limit=20&offset=0`
- `/api/editorial/overview?limit=3`
- `/api/posts?published=true&limit=20&offset=0`
- `/api/openapi`
- `/api/status` (APIView)
- `/api/posts-generic/<id>` (RetrieveUpdateDestroyAPIView via catch-all)
- `/posts/<slug>`

## What this example shows

This example uses the same three-model relation graph as the Express blog API example and pushes it through three consumers:

- server-rendered pages that query `PostModel.objects` directly
- App Router route handlers that expose Tango resources
- an editorial overview endpoint that returns nested hydrated rows over HTTP

The relation graph is:

- `Post.author`
- `User.posts`
- `Post.comments`
- `Comment.author`

The home page uses `selectRelated('author')` for joined author hydration, the post detail page uses `selectRelated('author').prefetchRelated('comments__author')`, and `GET /api/editorial/overview` exposes the same nested graph through a resource-backed endpoint. That makes this example useful both for the shared migration workflow and for real nested traversal with generated path typing.

## A good reading path through the example

1. `src/lib/models.ts` for the relation graph, shared data shapes, and Tango model metadata
2. `src/serializers/PostSerializer.ts` for the Zod-backed resource contract
3. `src/app/page.tsx` for joined author hydration in a server-rendered list page
4. `src/app/posts/[slug]/page.tsx` for nested post/comment hydration in a detail page
5. `src/views/EditorialOverviewAPIView.ts` for the HTTP-facing nested hydration example
6. `src/app/api/posts/[[...tango]]/route.ts` for `NextAdapter` wiring of a viewset
7. `src/app/api/posts-generic/[[...tango]]/route.ts` for the generic-view route-handler pattern
8. `scripts/bootstrap.ts` for seed data setup

## Project layout

- `tango.config.ts` Tango configuration
- `src/lib/models.ts` user, post, and comment schemas plus Tango model metadata
- `src/serializers/PostSerializer.ts` serializer-backed API contract for posts
- `migrations/` checked-in Tango migrations
- `.tango/` generated relation typing artifacts after `make:migrations` or `codegen:relations`
- `src/app/page.tsx` paginated list page
- `src/app/posts/[slug]/page.tsx` slug-based detail page
- `src/views/EditorialOverviewAPIView.ts` nested hydration example endpoint
- `src/app/api/editorial/overview/route.ts` App Router API route for the editorial overview
- `src/app/api/posts/[[...tango]]/route.ts` viewset-backed CRUD API
- `src/app/api/posts-generic/[[...tango]]/route.ts` generic-view example
- `src/app/api/status/route.ts` simple `APIView` example
- `src/lib/openapi.ts` OpenAPI generation from resource instances
- `scripts/bootstrap.ts` seed entrypoint
