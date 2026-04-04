# Tutorial: build the blog API

Start with the Express blog example when you want the clearest possible Tango application. Express still owns the server, middleware, and route registration. Tango supplies the model contract, migrations, serializers, viewsets, and OpenAPI generation underneath.

The goal is to add a `summary` field to blog posts and make the posts API searchable by that summary. By the end, `POST /api/posts` will accept `summary`, post responses will return it, and the existing `search` and `q` query parameters will match it.

## The feature you will add

The example already exposes a small blog API with users, posts, comments, one generic class-based endpoint, one fully custom endpoint, and an OpenAPI document generated from the same Tango resources the server uses at runtime.

When you run the server, you can call the following routes:

- `GET /health`
- `GET /api/healthz`
- `GET|POST /api/generic/users`
- CRUD routes for `/api/users`, `/api/posts`, and `/api/comments`
- list filtering, search, ordering, and offset pagination on the model-backed resources
- `GET /api/openapi.json`

The new feature extends the post resource in three ways:

- posts will accept an optional `summary` field when they are created or updated
- post list and detail responses will return `summary`
- post search will match `summary` as well as the existing title and content fields

That feature is a good first change because it takes you through the real application surfaces without forcing you to learn every part of the example at once.

## 1. Read the application in order

Before you change anything, read the example in the same order Express and Tango assemble it at runtime. That gives the later code changes some context.

### Start with the server entrypoint

Open `examples/blog-api/src/index.ts`.

This file shows the whole application assembled in one place. Express creates the server, installs JSON parsing, and attaches concrete routes. Tango starts to matter once the file begins constructing resources and handing them to `ExpressAdapter`.

Read the sequence from top to bottom:

1. Express creates the app and installs `express.json()`.
2. Optional seed data is loaded when `AUTO_BOOTSTRAP=true`.
3. The viewsets and API views are constructed.
4. `ExpressAdapter` turns those resource instances into real Express routes.
5. `/api/openapi.json` publishes an OpenAPI document generated from the same Tango resources.

That sequence is worth holding in your head because the feature you add later will not require changes here. The server already has a posts endpoint. Your work will happen lower in the stack, where the post contract and search behavior are declared.

### Read the post model

Open `examples/blog-api/src/models/PostModel.ts`.

In this example, `Post` means a blog post. The file defines that blog post in several closely related ways.

`PostReadSchema` describes the shape of a post once it has already been validated and loaded from persistence. `PostCreateSchema` describes what callers may submit when they create a post. `PostUpdateSchema` describes the partial-write contract for updates.

Below those schemas, `PostModel` adds the database-facing metadata Tango needs in order to treat the blog post as a real model. That metadata marks `id` as the primary key, marks `authorId` as a foreign key to the user model, and declares defaults for `published`, `createdAt`, and `updatedAt`.

The model also defines a `beforeUpdate` hook. That hook refreshes `updatedAt` whenever a post is changed through the model layer. Keeping that behavior on the model means it continues to run for API writes, scripts, and any other code that talks to `PostModel.objects`.

The `summary` field belongs here because the post model owns the stored shape of a post.

### Read the post serializer

Open `examples/blog-api/src/serializers/PostSerializer.ts`.

This file is intentionally small. `PostSerializer` gathers the post model, the create schema, the update schema, and the outward-facing read schema into one resource-facing contract.

That is the reason this tutorial uses a schema change as its hands-on feature. Once the schemas are correct, the serializer already knows how to validate incoming post data and how to produce the outward response shape. You will inspect this file, but you will not need to edit it.

### Read the post viewset

Open `examples/blog-api/src/viewsets/PostViewSet.ts`.

This class defines the HTTP surface for `/api/posts`. It keeps the collection routes, detail routes, and custom post-specific actions together in one place.

For the feature in this tutorial, focus on the constructor. `serializer` points the viewset at `PostSerializer`. `filters` declares the field filters and query aliases that the list route accepts. `orderingFields` declares which fields clients may use for ordering. `searchFields` declares which fields the generic text search will inspect.

The custom `publish` action sits below that constructor. It shows where resource-specific HTTP behavior belongs once the standard CRUD routes are no longer enough.

The viewset is where the new `summary` field becomes searchable.

### Inspect the other resource styles

After the post viewset makes sense, look at the other resource classes in the example.

`examples/blog-api/src/views/UserListCreateAPIView.ts` shows a generic class-based resource. It is useful when a model-backed endpoint needs a narrower surface than a full viewset.

`examples/blog-api/src/views/HealthAPIView.ts` shows a fully custom `APIView`. That is the resource style to use when the endpoint is not naturally a manager-backed CRUD resource at all.

Then open `examples/blog-api/src/openapi.ts`. That file generates an OpenAPI document by describing the same viewsets and views the server uses at runtime. The Express server publishes the result at `/api/openapi.json`.

That relationship matters for the feature you are about to add. Once the post schemas and resource contract change, the generated OpenAPI document will reflect the new field as well.

## 2. Add the feature from a fresh machine

The steps below assume a fresh machine and a fresh clone of the Tango repository. If your machine already has Git, Node 22, and pnpm 9 available, you can start at the clone step.

### Install the workspace prerequisites

Install Git from [git-scm.com](https://git-scm.com/downloads) if it is not already available on your machine.

Install `nvm` using the official install script:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
```

If you use `zsh` and do not already have a `~/.zshrc`, create it first with `touch ~/.zshrc`. After the install script finishes, open a new terminal or reload your shell profile so `nvm` is available.

Then install Node 22, enable Corepack, activate the workspace pnpm version, and clone Tango:

```bash
nvm install 22
nvm use 22
corepack enable
corepack prepare pnpm@9.13.2 --activate
git clone https://github.com/danceroutine/tango.git
cd tango
pnpm install
```

All remaining commands in this tutorial should be run from the repository root.

### Add `summary` to the post schemas

Open `examples/blog-api/src/models/PostModel.ts`.

Start with `PostReadSchema`. Add `summary` there because post responses read from that schema. Then add the same field to `PostCreateSchema` so clients may submit it when they create a post.

After the edit, those two schema definitions should look like this.

```ts
export const PostReadSchema = z.object({
    id: z.number(),
    title: z.string().min(1),
    summary: z.string().min(1).max(280).optional(),
    content: z.string().min(1),
    authorId: z.number(),
    published: z.coerce.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

export const PostCreateSchema = z.object({
    title: z.string().min(1),
    summary: z.string().min(1).max(280).optional(),
    content: z.string().min(1),
    authorId: z.number(),
    published: z.boolean().optional().default(false),
});
```

`PostUpdateSchema` is already built from `PostCreateSchema.partial()`, so it will pick up the new field automatically.

The important detail is how `PostModel` is declared a few lines later. Its stored schema is built from `PostReadSchema.extend(...)`. That means adding `summary` to `PostReadSchema` is also what makes `summary` part of the model's stored shape. Fields such as `id` and `authorId` still need explicit metadata in the `extend(...)` block because they carry primary-key and foreign-key behavior.

### Make the new field searchable

Open `examples/blog-api/src/viewsets/PostViewSet.ts`.

Find the `FilterSet` aliases and `searchFields`. Add `summary` to the existing search surfaces so the list route can match it.

After the edit, that part of the constructor should look like this.

```ts
filters: FilterSet.define<Post>({
    fields: {
        authorId: true,
        published: true,
    },
    aliases: {
        q: { fields: ['title', 'summary', 'content'], lookup: 'icontains' },
        created_after: { field: 'createdAt', lookup: 'gte' },
        created_before: { field: 'createdAt', lookup: 'lte' },
    },
}),
orderingFields: ['id', 'createdAt', 'updatedAt', 'title'],
searchFields: ['title', 'summary', 'content'],
```

That is enough to make the new field visible to both the generic `search` parameter and the explicit `q` alias.

### Leave the serializer and OpenAPI setup alone

Do not edit `examples/blog-api/src/serializers/PostSerializer.ts`.

The serializer already points at the post create, update, and read schemas. Once those schemas include `summary`, the serializer will validate and return the new field automatically.

Do not edit `examples/blog-api/src/openapi.ts` either.

The OpenAPI document is generated from the existing resource classes. Once the post resource reflects the new field, the generated document will reflect it too.

### Generate the migration

From the repository root, generate a migration for the new column:

```bash
pnpm --filter @danceroutine/tango-example-express-blog-api make:migrations --name add_post_summary
```

Open the new migration file in `examples/blog-api/migrations/` and confirm that it adds the new `summary` column to the posts table.

### Apply the migration

Once the generated migration looks correct, apply it to the example database:

```bash
pnpm --filter @danceroutine/tango-example-express-blog-api setup:schema
```

That command runs `tango migrate` with the example's `tango.config.ts`, so the local SQLite database moves to the new schema before you start the server.

### Bootstrap the example and start the server

Now prepare the example data and start the development server:

```bash
pnpm --filter @danceroutine/tango-example-express-blog-api bootstrap
pnpm --filter @danceroutine/tango-example-express-blog-api dev
```

`bootstrap` seeds the example database. `dev` starts the Express server. On a fresh machine, that is enough to get the application into a working state once the schema has already been updated.

Existing seeded posts will not have a `summary` value yet, because the new field is optional and the seed script was written before you added it. That is fine. You will create a fresh post next.

### Create a post that uses the new field

In a second terminal, create a post through the API:

```bash
curl -X POST http://localhost:3000/api/posts \
  -H 'content-type: application/json' \
  -d '{
    "title": "Fresh machine walkthrough",
    "summary": "A short overview used in search and list responses.",
    "content": "This post exists to verify the summary field end to end.",
    "authorId": 1,
    "published": true
  }'
```

The JSON response should now include `summary`.

### Verify that search and OpenAPI picked up the change

Now query the list route using text from the new summary:

```bash
curl 'http://localhost:3000/api/posts?search=overview'
curl 'http://localhost:3000/api/posts?q=overview'
```

Both requests should return the post you just created. The first request uses the built-in search parameter. The second uses the explicit `q` alias declared in `PostViewSet`.

Finally, confirm that the generated OpenAPI document now knows about the field as well:

```bash
curl 'http://localhost:3000/api/openapi.json'
```

Search the returned JSON for `summary`. You should see it appear in the post schema without any manual OpenAPI editing.

At that point you have completed the whole loop.

1. change the model and schema contract
2. refine the resource's public search behavior
3. generate and apply a migration
4. run the app
5. verify the feature through the API and the generated OpenAPI document

## What to read next

- [Models and schema](/topics/models-and-schema)
- [API layer](/topics/api-layer)
- [Migrations](/topics/migrations)
- [How to work with serializers](/how-to/working-with-serializers)
- [How to build your API with viewsets](/how-to/build-your-api-with-viewsets)
