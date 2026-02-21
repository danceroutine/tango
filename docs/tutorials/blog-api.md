# Tutorial: build the blog API

The Express example in `examples/blog-api` shows how Tango's model, migration, serializer, model-hook, resource, and adapter layers fit together.

The shape of this tutorial is intentionally close to Django and DRF tutorials: you build something concrete first, then use the topic guides and reference pages to deepen individual parts later.

## What you are building

The example application exposes:

- `GET /health`
- `GET /api/healthz`
- `GET|POST /api/generic/users`
- CRUD endpoints for users, posts, and comments through viewsets
- list filtering, search, ordering, and offset pagination
- `GET /api/openapi.json`

## 1. Run the example

```bash
pnpm --filter @danceroutine/tango-example-express-blog-api bootstrap
pnpm --filter @danceroutine/tango-example-express-blog-api dev
```

Now visit:

- `http://localhost:3000/health`
- `http://localhost:3000/api/posts?limit=20&offset=0`
- `http://localhost:3000/api/openapi.json`

## 2. Start at the application wiring

This file shows the full wiring sequence:

1. create the Express app
2. create a database client
3. assert the schema is present
4. construct viewsets and API views
5. register them with `ExpressAdapter`

Tracing that wiring sequence is the fastest way to understand how a Tango application is assembled.

## 3. Read one model

Notice the pattern:

- a read schema defines the shape returned from the database and the API
- a create schema defines the body accepted by POST
- an update schema defines the body accepted by PATCH or PUT
- `PostModel` wraps the read schema with Tango metadata and model hooks

The metadata includes:

- the primary key
- the `authorId` foreign key
- default values for `published`, `createdAt`, and `updatedAt`

The model hook layer is where record lifecycle rules live when they should keep applying outside one resource.

## 4. Read one serializer

The serializer is where the resource contract becomes concrete.

It ties together:

- the model manager used for persistence
- the create schema
- the update schema
- the outward-facing read schema

Serializer hooks are available for request-scoped normalization. Record lifecycle behavior belongs with the model so the same rule keeps running for every caller of `Model.objects`.

## 5. Read one viewset

The viewset is the point in the stack where the HTTP surface becomes explicit.

The viewset config ties the serializer to the public list contract. Filtering, ordering, and search stay explicit, which tells clients what the endpoint supports without exposing raw ORM syntax directly.

## 6. Inspect the other resource styles

These files show the other resource styles:

- `APIView` for a fully custom endpoint
- generic CRUD views for a model-backed endpoint that does not need a full viewset

The example also includes `src/openapi.ts`, which generates an OpenAPI document from Tango resource instances, and `/api/openapi.json`, which publishes that document as JSON.

## 7. Try the list API

Use these URLs while the server is running:

- `/api/posts?limit=20&offset=0`
- `/api/posts?published=true`
- `/api/posts?search=serializer`
- `/api/posts?ordering=-createdAt`
- `/api/posts?authorId=1&published=true`

Each query is handled by the combination of `FilterSet`, `searchFields`, `orderingFields`, and `OffsetPaginator`.

## 8. Make one schema change

Add an optional `summary` field to the post schemas and model metadata, then generate and apply a migration.

The commands are:

```bash
pnpm --filter @danceroutine/tango-example-express-blog-api make:migrations --name add_summary
pnpm --filter @danceroutine/tango-example-express-blog-api setup:schema
```

After that, update the serializer, any model hooks affected by the new field, and any resource behavior that should expose the field, then hit the API again.

## What to read next

- [Models and schema](/topics/models-and-schema)
- [Model lifecycle hooks](/topics/model-lifecycle-hooks)
- [Serializers](/topics/serializers)
- [Resources and viewsets](/topics/resources-and-viewsets)
- [Migrations](/topics/migrations)
