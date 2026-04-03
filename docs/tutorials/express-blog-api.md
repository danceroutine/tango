# Tutorial: build the blog API

This tutorial walks through the Express example application in `examples/blog-api`.

The goal is to see Tango in a working server before you break the framework into smaller concepts. By the end of the tutorial, you should know how the example is wired, which file owns each layer of the stack, and where to look when you want to adapt the same pattern in your own application.

## What you are building

The example is a blog API with three model-backed resources: users, posts, and comments. It also includes one fully custom endpoint, one generic class-based resource, and an OpenAPI document generated from the same Tango resource instances the server uses at runtime.

When the server is running, the application exposes:

- `GET /health`
- `GET /api/healthz`
- `GET|POST /api/generic/users`
- CRUD routes for `/api/users`, `/api/posts`, and `/api/comments`
- list filtering, search, ordering, and offset pagination on the model-backed resources
- `GET /api/openapi.json`

## 1. Run the example

If you want to run the example exactly as this tutorial describes, work from a local clone of the Tango repository. The example application lives inside that workspace.

Start by bootstrapping the example data and then running the development server:

```bash
pnpm --filter @danceroutine/tango-example-express-blog-api bootstrap
pnpm --filter @danceroutine/tango-example-express-blog-api dev
```

The `bootstrap` script applies the checked-in migrations and seeds a larger dataset so the list endpoints are interesting to explore immediately. The `dev` script starts the Express server and makes sure the schema is applied before the process begins handling requests.

Once the server is running, open a few endpoints in your browser or API client:

- `http://localhost:3000/health`
- `http://localhost:3000/api/posts?limit=20&offset=0`
- `http://localhost:3000/api/posts?published=true&ordering=-createdAt`
- `http://localhost:3000/api/openapi.json`

The first endpoint confirms that the Express server itself is running. The post endpoints show a Tango viewset handling filtering, ordering, and pagination. The OpenAPI document shows that the same resource classes can also describe the public API contract for tooling and client generation.

## 2. Start with the application entrypoint

Open `src/index.ts` next.

This file is the clearest place to begin because it shows the whole application assembled in one place. Express still owns server startup, middleware registration, and route attachment. Tango begins to matter once the example starts constructing resources and registering them with `ExpressAdapter`.

Read the file from top to bottom and notice the sequence:

1. create the Express app and register JSON parsing
2. optionally seed example data at startup when `AUTO_BOOTSTRAP=true`
3. construct the resource instances
4. create an `ExpressAdapter`
5. register viewsets and API views on concrete URL prefixes
6. expose `/api/openapi.json` from the generated specification

That sequence is worth understanding before you study any one model or resource in isolation, because it shows the basic Tango relationship with a host framework. Express remains responsible for the server process while Tango provides the application-facing layers that the adapter turns into HTTP routes.

## 3. Read one model definition

Open `src/models/PostModel.ts`.

In this example, `Post` means a blog post. The file defines that blog post in several closely related ways.

`PostReadSchema` describes the fully loaded post shape that the rest of the application can expect after persistence and validation have already happened. `PostCreateSchema` describes what callers may submit when they create a post. `PostUpdateSchema` describes the partial-write contract for updates.

After those schemas, `PostModel` adds the database-facing metadata that Tango needs in order to treat the blog post as a real model. That metadata marks `id` as the primary key, marks `authorId` as a foreign key to the user model, and declares defaults for `published`, `createdAt`, and `updatedAt`.

The same file also includes a `beforeUpdate` hook. That hook is where the example keeps record lifecycle behavior that should continue to run whenever the post is updated through the model layer. In this case, the hook refreshes `updatedAt` whenever a post is changed. Keeping that rule on the model means the rule remains true for API writes, scripts, seed utilities, and direct manager usage.

## 4. Read one serializer

Open `src/serializers/PostSerializer.ts`.

The file is intentionally small, which makes it easier to see what a `ModelSerializer` is doing when most of the request and response contract is already expressed by the post schemas you just read.

`PostSerializer` ties four things together:

- the `PostModel`
- the create schema
- the update schema
- the outward-facing read schema

That gives the resource layer one object it can use to validate incoming data, persist the model through `PostModel.objects`, and produce a consistent response shape on the way out.

The post example keeps no serializer hooks because the write contract is already straightforward. The more useful lesson is how the two layers divide their work. Request-specific normalization belongs in the serializer when you need it, while record lifecycle behavior that should apply for every write belongs on the model.

## 5. Read one viewset

Open `src/viewsets/PostViewSet.ts`.

This file is where the HTTP surface for posts becomes explicit. A viewset groups the collection routes, detail routes, and custom actions for one resource into one class. In a conventional Express application, you might spread this behavior across several route handlers. Here, the viewset keeps it together.

The constructor shows the public list contract for `/api/posts`. The serializer establishes the request and response contract. The `FilterSet` declares field filters such as `authorId` and `published`, and also declares aliases such as `q`, `created_after`, and `created_before`. `orderingFields` and `searchFields` declare which list features the endpoint will honor.

The file also defines a `publish` detail action. That method is useful because it shows where resource-specific HTTP behavior lives once the standard CRUD actions are no longer enough.

This viewset does not configure a custom paginator. Tango therefore uses its default offset pagination for the list route, which is why the running example accepts `limit` and `offset` query parameters.

## 6. Inspect the other resource styles

After you understand the post viewset, look at the other two resource styles in the example.

`src/views/UserListCreateAPIView.ts` shows a generic class-based resource. It is useful when a model-backed endpoint needs a narrower surface than a full viewset. In this example, the generic view handles listing and creating users without taking on the full detail-route surface.

`src/views/HealthAPIView.ts` shows a custom `APIView`. This is the resource style to use when the endpoint is not naturally a manager-backed CRUD resource at all. The health endpoint simply returns a small JSON response, so a custom API view is the clearest fit.

Then read `src/openapi.ts`. That file generates an OpenAPI document by describing the same viewsets and views the server uses at runtime. The Express server then publishes the result at `/api/openapi.json`.

## 7. Exercise the running API

With the server still running, try a few list queries against `/api/posts`:

- `/api/posts?limit=20&offset=0`
- `/api/posts?published=true`
- `/api/posts?authorId=1&published=true`
- `/api/posts?search=API`
- `/api/posts?q=API`
- `/api/posts?ordering=-createdAt`

These requests let you see several pieces of the resource layer working together. Field filters come from the declared `FilterSet`. Full-text style matching can come from `searchFields` or from explicit aliases such as `q`. Ordering comes from `orderingFields`. Pagination comes from the default offset paginator.

At this point, compare the request URLs with `PostViewSet.ts`. That comparison connects the public API you can call from the outside with the resource declaration that produces it.

## 8. Make one schema change

Once the example feels familiar, make one small schema change so you can see the model and migration workflow together.

Add an optional `summary` field to the post contract in `src/models/PostModel.ts`. In practice, that means adding the field to `PostReadSchema`, `PostCreateSchema`, and `PostUpdateSchema`, and then including the same field in the model metadata that Tango uses to define the stored schema.

After that change, generate and apply a migration:

```bash
pnpm --filter @danceroutine/tango-example-express-blog-api make:migrations --name add_summary
pnpm --filter @danceroutine/tango-example-express-blog-api setup:schema
```

Read the generated migration before you apply it. Once it looks correct, run the setup command so the example database moves to the new schema.

Because `PostSerializer` already points at the post create, update, and read schemas, you usually do not need to change the serializer class itself for a simple field addition. The work is mainly in the schemas, the model metadata, and any resource behavior that should filter, order, search, or otherwise expose the new field.

After that, call the post endpoints again and confirm that the new field behaves the way you expect.

## What to read next

- [Models and schema](/topics/models-and-schema)
- [API layer](/topics/api-layer)
- [Migrations](/topics/migrations)
- [How to work with serializers](/how-to/working-with-serializers)
- [How to build your API with viewsets](/how-to/build-your-api-with-viewsets)
