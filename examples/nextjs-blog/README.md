# Next.js Blog Example (App Router + SQLite)

This example shows Tango inside a Next.js App Router project. Server components still render pages, route handlers still own HTTP endpoints, and Tango provides model metadata, `Model.objects`, migrations, serializers, model hooks, and resource behavior underneath.

## Quick start

```bash
pnpm --filter @danceroutine/tango-example-nextjs-blog setup:schema
pnpm --filter @danceroutine/tango-example-nextjs-blog bootstrap
pnpm --filter @danceroutine/tango-example-nextjs-blog dev
```

`setup:schema` applies the checked-in Tango migrations. `bootstrap` seeds enough posts to make pagination, search, and published-state behavior worth exploring in the browser.

Optional environment variables:

- `TANGO_SQLITE_FILENAME` (default: `./.data/nextjs-blog.sqlite`)
- `SEED_POSTS_COUNT` (default: `1000`)

## Useful URLs

- `/` (paginated published posts)
- `/?search=tango&limit=20&offset=0`
- `/api/posts?published=true&limit=20&offset=0`
- `/api/openapi`
- `/api/status` (APIView)
- `/api/posts-generic/<id>` (RetrieveUpdateDestroyAPIView via catch-all)
- `/posts/<slug>`

## A good reading path through the example

1. `src/lib/models.ts` for the relationship between page-facing data shapes, Tango model metadata, and model lifecycle hooks
2. `src/serializers/PostSerializer.ts` for the Zod-backed resource contract
3. `src/app/page.tsx` for `PostModel.objects`-driven server rendering
4. `src/app/posts/[slug]/page.tsx` for slug-based detail loading
5. `src/app/api/posts/[[...tango]]/route.ts` for `NextAdapter` wiring of a viewset
6. `src/app/api/posts-generic/[[...tango]]/route.ts` for the generic-view route-handler pattern
7. `scripts/bootstrap.ts` for seed data setup

## Project layout

- `tango.config.ts` Tango configuration
- `src/lib/models.ts` post schemas, Tango model metadata, and model hooks
- `src/serializers/PostSerializer.ts` serializer-backed API contract for posts
- `migrations/` checked-in Tango migrations
- `src/app/page.tsx` paginated list page
- `src/app/posts/[slug]/page.tsx` slug-based detail page
- `src/app/api/posts/[[...tango]]/route.ts` viewset-backed CRUD API
- `src/app/api/posts-generic/[[...tango]]/route.ts` generic-view example
- `src/app/api/status/route.ts` simple `APIView` example
- `src/lib/openapi.ts` OpenAPI generation from resource instances
- `scripts/bootstrap.ts` seed entrypoint
