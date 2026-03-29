# Quickstart

Run the example applications in this repository to inspect Tango in a working project before you start building your own app.

## Prerequisites

- Node.js 22 or newer
- pnpm 9 or newer
- this repository checked out locally

```bash
pnpm install
```

## Run the Express example

The Express example is the fastest way to see the full Tango stack in one place: models, serializers, migrations, viewsets, filtering, pagination, and an adapter.

```bash
pnpm --filter @danceroutine/tango-example-express-blog-api bootstrap
pnpm --filter @danceroutine/tango-example-express-blog-api dev
```

Then open:

- `http://localhost:3000/health`
- `http://localhost:3000/api/posts?limit=20&offset=0`
- `http://localhost:3000/api/posts?published=true&ordering=-createdAt`

If you want to inspect the example code after it is running, start with the model, serializer, viewset, and generic view used for posts and users.

## Run the Next.js example

The Next.js example shows the same Tango primitives used inside App Router route handlers instead of Express.

```bash
pnpm --filter @danceroutine/tango-example-nextjs-blog bootstrap
pnpm --filter @danceroutine/tango-example-nextjs-blog dev
```

Then open:

- `http://localhost:3001/`
- `http://localhost:3001/api/posts?limit=20&offset=0`

If you want to inspect the example code after it is running, start with the model definitions, the serializer, the post viewset, and the detail API view.

## What to look for

As you browse the examples, keep this sequence in mind:

1. A model definition describes shape and schema metadata.
2. A serializer defines the create, update, and output contract for the HTTP boundary.
3. A migration keeps the database schema aligned with the model metadata.
4. A view class or viewset turns model-backed resource behavior into HTTP endpoints.
5. An adapter connects those view classes to Express or Next.js.

## Next steps

- [Blog API tutorial](/tutorials/blog-api)
- [Next.js tutorial](/tutorials/nextjs-blog)
- [Models and schema](/topics/models-and-schema)
- [Serializers](/topics/serializers)
