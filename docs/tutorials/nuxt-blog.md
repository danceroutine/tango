# Tutorial: build the Nuxt blog

The goal is to add a `summary` field to posts and make that field show up in two places: the Nitro API and the regular Nuxt UI. By the end, `POST /api/posts` will accept `summary`, API responses will return it, the posts API will search it, and the home page will both render and search it without going through the API layer.

## The feature you will add

The example combines server-rendered blog pages with a small API surface.

When you run the app, you can:

- browse published posts at `/`
- open a server-rendered detail page at `/posts/<slug>`
- call a viewset-backed API at `/api/posts`
- call a generic detail API at `/api/posts-generic/<id>`
- call a custom `APIView` at `/api/status`
- fetch an OpenAPI document at `/api/openapi`

The new feature extends the post workflow in four ways:

- posts will accept an optional `summary` field when they are created or updated
- post API responses will return `summary`
- the posts API will search `summary` as well as the existing title and content fields
- the Nuxt home page will search and display `summary` directly from the shared model layer

This feature shows the central idea of the app clearly. One model change can flow into a Nuxt page and a Tango-backed Nitro API route at the same time.

## 1. Read the application in order

Before you change anything, read the example in the order the shared model layer flows outward into pages and Nitro handlers.

### Start with the Nuxt integration seam

Open `examples/nuxt-blog/nuxt.config.ts`.

This is the clearest place to begin because it shows exactly where Tango meets Nuxt.

Nuxt still owns the application shell, the page layer, and server rendering. The Tango-specific part of the integration happens in `serverHandlers`, where Nitro routes such as `/api/posts`, `/api/posts-generic`, `/api/status`, and `/api/openapi` are mapped to explicit handler files under `server/tango/`.

That pattern defines the example. Nuxt and Nitro own the framework entrypoints, while Tango supplies the resource behavior those handlers delegate to.

### Read the shared model layer

Open `examples/nuxt-blog/lib/models.ts`.

This is the shared post contract that both the UI layer and the API layer depend on.

`PostReadSchema` describes the post shape that Nuxt pages and API responses can both rely on. `PostCreateSchema` describes what callers may submit when they create a post through the API. `PostModel` adds the database-facing metadata Tango needs in order to treat the post as a real model, including the primary key, the unique slug, and the defaults for `published`, `createdAt`, and `updatedAt`.

This file also includes one Nuxt-specific requirement: `registerModelObjects()`. In this example, the app is wired directly against workspace source, and Nuxt or Nitro can tree-shake side-effect-only runtime imports. Calling `registerModelObjects()` here keeps `PostModel.objects` available in SSR pages and Nitro handlers.

The model also owns the lifecycle hooks for slug generation and timestamp stamping. That keeps those persistence rules aligned no matter which part of the application writes the post.

The `summary` field belongs here because this file defines the shared post contract.

### Read the Nuxt home page

Open `examples/nuxt-blog/app/pages/index.server.vue`.

The home page shows the simplest way Tango appears inside a Nuxt SSR page: the page queries the model manager directly. `PostModel.objects.query()` builds the published-post query, `toNuxtQueryParams(...)` turns the incoming route query into Tango-style query params, and `OffsetPaginator` produces a paginated listing for the front page.

The search logic in this page is the UI half of the feature you are about to add. The page is not calling `/api/posts`. It builds the query itself against `PostModel.objects`, so a new searchable field has to be added here as well as in the API layer.

This is also where you will render the new summary value for readers who browse the site in the browser.

### Read the serializer

Open `examples/nuxt-blog/serializers/PostSerializer.ts`.

The file is intentionally small. `PostSerializer` gathers the post model, the create schema, the update schema, and the outward-facing read schema into one HTTP-facing contract.

Once the schemas are correct, the serializer already knows how to validate incoming post data and how to produce the outward response shape. You will inspect this file, but you will not need to edit it.

### Read the post viewset

Open `examples/nuxt-blog/viewsets/PostViewSet.ts`.

This class defines the collection and detail API surface for `/api/posts`. The constructor is the important part for the feature in this tutorial. `serializer` points the viewset at `PostSerializer`. `filters` declares the field filters and query aliases the list route accepts. `orderingFields` declares which fields clients may use for ordering. `searchFields` declares which fields the API's generic text search will inspect.

The custom `publish` action sits below that constructor. It shows where post-specific HTTP behavior belongs once the standard CRUD routes are no longer enough.

This is where the API half of the `summary` feature becomes searchable.

### Read the Nitro handlers and OpenAPI path

Now open `examples/nuxt-blog/server/tango/posts.ts`.

`NuxtAdapter` takes `PostViewSet` and adapts it into a Nitro route handler. You do not need to change it for this feature. Once the viewset and serializer know about the field, the handler continues to work.

Then open `examples/nuxt-blog/lib/openapi.ts` and `examples/nuxt-blog/server/tango/openapi.ts`.

Those files generate and publish an OpenAPI document from the same Tango resources the app uses at runtime. The new post field will show up there too without a second documentation-only edit.

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

### Prepare the Tango workspace packages

Before you run Nuxt-specific commands, build the Tango workspace packages the example depends on:

```bash
pnpm --filter @danceroutine/tango-example-nuxt-blog prepare:tango
```

This example uses source-linked workspace packages. `prepare:tango` builds the Tango packages so the Nuxt and Nitro runtime can consume them correctly.

### Add `summary` to the shared post schemas

Open `examples/nuxt-blog/lib/models.ts`.

Start with `PostReadSchema`. Add `summary` there because both the rendered pages and the API responses read from that schema. Then add the same field to `PostCreateSchema` so API clients may submit it when they create a post.

After the edit, those two schema definitions should look like this:

```ts
export const PostReadSchema = z.object({
    id: z.number(),
    title: z.string().min(1).max(200),
    slug: z.string(),
    summary: z.string().min(1).max(280).optional(),
    content: z.string(),
    excerpt: z.string().nullable().optional(),
    published: z.coerce.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

export const PostCreateSchema = z.object({
    title: z.string().min(1).max(200),
    slug: z.string().optional(),
    summary: z.string().min(1).max(280).optional(),
    content: z.string().min(1),
    excerpt: z.string().optional(),
    published: z.boolean().optional().default(false),
});
```

`PostSerializer` uses `PostCreateSchema` for creation and `PostCreateSchema.partial()` for updates, so the serializer will pick up the new field automatically.

This example also uses `PostReadSchema.extend(...)` as the stored model schema. Adding `summary` to `PostReadSchema` is enough to make `summary` part of the stored shape. Fields such as `id` and `slug` still need explicit metadata in the `extend(...)` block because they carry primary-key and uniqueness behavior.

### Make the API search the new field

Open `examples/nuxt-blog/viewsets/PostViewSet.ts`.

Find the `FilterSet` aliases and `searchFields`. Add `summary` to the existing search surfaces so `/api/posts` can match it.

After the edit, that part of the constructor should look like this:

```ts
filters: FilterSet.define<Post>({
    fields: {
        published: true,
        slug: true,
    },
    aliases: {
        q: { fields: ['title', 'summary', 'content'], lookup: 'icontains' },
    },
}),
orderingFields: ['id', 'createdAt', 'updatedAt', 'title'],
searchFields: ['title', 'summary', 'content'],
```

That change makes the new field visible to both the generic `search` parameter and the explicit `q` alias on the API route.

### Make the Nuxt page search and render the new field

Open `examples/nuxt-blog/app/pages/index.server.vue`.

This page is the UI half of the feature. Because it queries `PostModel.objects` directly, it needs its own search and rendering changes.

First, update the search filter array so the page searches `summary` in addition to `title` and `content`:

```ts
if (search) {
    const searchFilters: FilterInput<Post>[] = [
        { title__icontains: search },
        { summary__icontains: search },
        { content__icontains: search },
    ];
    qs = qs.filter(Q.or(...searchFilters));
}
```

Then update the rendered card so the page shows `summary` when it exists, and falls back to the existing excerpt otherwise:

```vue
<p v-if="post.summary">{{ post.summary }}</p>
<p v-else-if="post.excerpt">{{ post.excerpt }}</p>
```

While you are in the same file, update the search input placeholder so the page's UI matches the broader search behavior:

```vue
placeholder="Search title, summary, or content"
```

This is the clearest place to see the distinction between the Nuxt UI and the Nitro API route. The home page reads the same model-backed post contract directly, so it needs its own search and rendering change.

### Leave the serializer, Nitro handler, and OpenAPI wiring alone

Do not edit `examples/nuxt-blog/serializers/PostSerializer.ts`.

The serializer already points at the shared post schemas, so it will validate and return `summary` automatically once those schemas include it.

Do not edit `examples/nuxt-blog/server/tango/posts.ts` either.

That file only adapts `PostViewSet` into a Nitro handler. The Nitro wiring does not change when the resource contract changes.

Do not edit `examples/nuxt-blog/lib/openapi.ts` or `examples/nuxt-blog/server/tango/openapi.ts`.

The OpenAPI document is generated from the existing Tango resources. Once the schemas and viewset reflect `summary`, the generated document will reflect it too.

### Generate the migration

From the repository root, generate a migration for the new column:

```bash
pnpm --filter @danceroutine/tango-example-nuxt-blog make:migrations --name add_post_summary
```

Open the new migration file in `examples/nuxt-blog/migrations/` and confirm that it adds the new `summary` column to the posts table.

### Apply the migration

Once the generated migration looks correct, apply it to the example database:

```bash
pnpm --filter @danceroutine/tango-example-nuxt-blog setup:schema
```

That command runs `tango migrate` with the example's `tango.config.ts`, so the local SQLite database moves to the new schema before you start the server.

### Bootstrap the example and start Nuxt

Now prepare the example data and start the development server:

```bash
pnpm --filter @danceroutine/tango-example-nuxt-blog bootstrap
pnpm --filter @danceroutine/tango-example-nuxt-blog dev
```

`bootstrap` seeds the example database. `dev` starts the Nuxt application. On a fresh machine, that is enough to get the app into a working state once the schema has already been updated.

Existing seeded posts will not have a `summary` value yet, because the new field is optional and the seed script was written before you added it. That is fine. You will create a fresh published post next.

### Create a post through the API

In a second terminal, create a post that uses the new field:

```bash
curl -X POST http://localhost:3002/api/posts \
  -H 'content-type: application/json' \
  -d '{
    "title": "Fresh machine walkthrough",
    "summary": "A short overview that should appear in the API and on the Nuxt page.",
    "content": "This post exists to verify the summary field end to end.",
    "published": true
  }'
```

The JSON response should now include `summary`.

### Verify the API result

Now query the API using text from the new summary:

```bash
curl 'http://localhost:3002/api/posts?search=overview'
curl 'http://localhost:3002/api/posts?q=overview'
```

Both requests should return the post you just created. The first request uses the built-in search parameter. The second uses the explicit `q` alias declared in `PostViewSet`.

### Verify the Nuxt UI

Open the home page in your browser:

- `http://localhost:3002/`
- `http://localhost:3002/?search=overview`

The first page should show the new post in the list, with the summary rendered in the card body. The second page should return the same post when you search for text that only appears in the summary.

That is the direct-model UI path working. The page is not querying `/api/posts`; it is reading the same shared model contract from `PostModel.objects`.

### Verify the generated OpenAPI document

Finally, confirm that the generated OpenAPI document now includes the new field:

```bash
curl 'http://localhost:3002/api/openapi'
```

Search the returned JSON for `summary`. You should see it appear in the post schema without any manual OpenAPI editing.

You have now completed the whole loop:

1. change the shared model and schema contract
2. refine the API resource's search behavior
3. refine the Nuxt page's direct model query and rendering
4. generate and apply a migration
5. run the app
6. verify the feature through both the API and the rendered page

## What to read next

- [Next.js blog tutorial](/tutorials/nextjs-blog)
- [Models and schema](/topics/models-and-schema)
- [API layer](/topics/api-layer)
- [Auto-document your API](/how-to/auto-document-your-api)
