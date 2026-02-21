# Blog API Example (Express + SQLite)

This example shows Tango inside a conventional Express application. Express still owns the server and route registration, while Tango provides model metadata, `Model.objects`, migrations, resources, and OpenAPI generation from resource instances underneath.

## Quick start

```bash
pnpm --filter @danceroutine/tango-example-express-blog-api setup:schema
pnpm --filter @danceroutine/tango-example-express-blog-api bootstrap
pnpm --filter @danceroutine/tango-example-express-blog-api dev
```

`setup:schema` applies the checked-in Tango migrations. `bootstrap` seeds a larger dataset so the list endpoints are interesting to explore immediately.

Optional environment variables:

- `TANGO_SQLITE_FILENAME` (default: `./.data/blog-api.sqlite`)
- `SEED_POSTS_COUNT` (default: `1000`)
- `AUTO_BOOTSTRAP=true` to seed automatically at server start

## Useful endpoints

- `GET /health`
- `GET /api/openapi.json`
- `GET /api/healthz` (APIView)
- `GET|POST /api/generic/users` (ListCreateAPIView)
- `GET /api/posts?published=true&limit=20&offset=0&ordering=-createdAt`
- `GET /api/posts?search=manager`
- `POST /api/posts/:id/publish`

## A good reading path through the example

1. `src/index.ts` for the Express wiring sequence
2. `src/models/` for read, create, update, and model-metadata definitions
3. `src/viewsets/` for HTTP contract declaration on top of `Model.objects`
4. `src/views/` for custom and generic class-based endpoints
5. `src/openapi.ts` for OpenAPI generation from resource instances
6. `scripts/bootstrap.ts` for realistic seed data

## Project layout

- `tango.config.ts` Tango configuration
- `src/models/` read, create, and update schemas plus Tango model metadata
- `src/viewsets/` CRUD resources backed by `Model.objects`
- `src/views/` custom `APIView` and generic resource examples
- `src/openapi.ts` OpenAPI document generation
- `migrations/` checked-in Tango migrations
- `scripts/bootstrap.ts` seed utility for a larger demo dataset
- `src/index.ts` Express server entrypoint
