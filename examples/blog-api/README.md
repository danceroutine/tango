# Blog API Example (Express + SQLite)

This example shows Tango inside a conventional Express application. Express still owns the server and route registration, while Tango provides model metadata, `Model.objects`, migrations, resources, and OpenAPI generation from resource instances underneath.

## Quick start

```bash
pnpm --filter @danceroutine/tango-example-express-blog-api setup:schema
pnpm --filter @danceroutine/tango-example-express-blog-api bootstrap
pnpm --filter @danceroutine/tango-example-express-blog-api dev
```

`setup:schema` applies the checked-in Tango migrations. `bootstrap` seeds a larger dataset so the list endpoints are interesting to explore immediately.

When you change model metadata, use:

```bash
pnpm --filter @danceroutine/tango-example-express-blog-api make:migrations --name add_field
```

That workflow generates the migration and refreshes the generated relation registry at the same time. If you only changed relation metadata and do not need a new migration file, run:

```bash
pnpm --filter @danceroutine/tango-example-express-blog-api codegen:relations
```

Optional environment variables:

- `TANGO_SQLITE_FILENAME` (default: `./.data/blog-api.sqlite`)
- `SEED_POSTS_COUNT` (default: `1000`)
- `AUTO_BOOTSTRAP=true` to seed automatically at server start

## Useful endpoints

- `GET /health`
- `GET /api/openapi.json`
- `GET /api/healthz` (APIView)
- `GET /api/editorial/overview?limit=3` (nested eager-loading example)
- `GET|POST /api/generic/users` (ListCreateAPIView)
- `GET /api/posts?published=true&limit=20&offset=0&ordering=-createdAt`
- `GET /api/posts?search=manager`
- `POST /api/posts/:id/publish`

## Relation graph to inspect

This example is a straightforward place to inspect Tango's nested relation hydration and generated path typing because the models form a real relation graph:

- `Post.author`
- `User.posts`
- `Post.comments`
- `Comment.author`

That means the example's model module is suitable both for the runtime relation graph and for generated relation typing. After the generated registry is current, application code can use nested paths such as `selectRelated('author')`, `prefetchRelated('posts__author')`, and `prefetchRelated('posts__comments')` without falling back to explicit reverse target-model generics in the common case.

The `GET /api/editorial/overview` endpoint exercises those paths through a real HTTP response. It runs:

- `UserModel.objects.query().prefetchRelated('posts__author', 'posts__comments__author')`
- `PostModel.objects.query().selectRelated('author').prefetchRelated('comments__author')`

## A good reading path through the example

1. `src/index.ts` for the Express wiring sequence
2. `src/models/` for read, create, update, model-metadata definitions, and the relation graph that drives generated path typing
3. `src/viewsets/` for HTTP contract declaration on top of `Model.objects`
4. `src/views/EditorialOverviewAPIView.ts` for a concrete nested-hydration example on top of the ORM
5. `src/views/` for the rest of the custom and generic class-based endpoints
6. `src/openapi.ts` for OpenAPI generation from resource instances
7. `scripts/bootstrap.ts` for realistic seed data

## Project layout

- `tango.config.ts` Tango configuration
- `src/models/` read, create, and update schemas plus Tango model metadata
- `src/viewsets/` CRUD resources backed by `Model.objects`
- `src/views/` custom `APIView`, generic resource, and nested relation hydration examples
- `src/openapi.ts` OpenAPI document generation
- `migrations/` checked-in Tango migrations
- `.tango/` generated relation typing artifacts after `make:migrations` or `codegen:relations`
- `scripts/bootstrap.ts` seed utility for a larger demo dataset
- `src/index.ts` Express server entrypoint
