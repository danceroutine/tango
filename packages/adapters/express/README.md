# @danceroutine/tango-adapters-express

`@danceroutine/tango-adapters-express` runs Tango views and viewsets inside Express.

Express still owns routing, middleware, request lifecycle, and application bootstrapping. This package connects those Express responsibilities to Tango's framework-agnostic resource layer, filtering, pagination, serializer-backed request and response contracts, and response conventions.

## Install

```bash
pnpm add @danceroutine/tango-adapters-express express
```

In a real application you will usually install this alongside the Tango packages that define your models, serializers, and resource classes.

## How it fits into an Express application

A typical Tango + Express stack looks like this:

1. define models with `@danceroutine/tango-schema`
2. query and mutate data through `Model.objects` from `@danceroutine/tango-orm`
3. define serializer-backed resource behavior with `@danceroutine/tango-resources`
4. use `ExpressAdapter` to register those handlers with Express routes

The adapter's responsibility is restricted to translating between Express request handlers and Tango's framework-agnostic view and viewset interfaces, then handing the resulting response back to Express.

## Quick start

```ts
import express from 'express';
import { z } from 'zod';
import '@danceroutine/tango-orm/runtime';
import { ExpressAdapter } from '@danceroutine/tango-adapters-express/adapter';
import { Model, t } from '@danceroutine/tango-schema';
import { ModelSerializer, ModelViewSet } from '@danceroutine/tango-resources';

const TodoReadSchema = z.object({
    id: z.number(),
    title: z.string(),
    completed: z.boolean(),
});

const TodoCreateSchema = TodoReadSchema.omit({ id: true });
const TodoUpdateSchema = TodoCreateSchema.partial();

type Todo = z.infer<typeof TodoReadSchema>;

const TodoModel = Model({
    namespace: 'app',
    name: 'Todo',
    schema: TodoReadSchema.extend({
        id: t.primaryKey(z.number().int()),
        title: z.string(),
        completed: t.default(z.boolean(), 'false'),
    }),
});

class TodoSerializer extends ModelSerializer<
    Todo,
    typeof TodoCreateSchema,
    typeof TodoUpdateSchema,
    typeof TodoReadSchema
> {
    static readonly model = TodoModel;
    static readonly createSchema = TodoCreateSchema;
    static readonly updateSchema = TodoUpdateSchema;
    static readonly outputSchema = TodoReadSchema;
}

class TodoViewSet extends ModelViewSet<Todo, typeof TodoSerializer> {
    constructor() {
        super({
            serializer: TodoSerializer,
            orderingFields: ['id', 'title'],
        });
    }
}

async function main(): Promise<void> {
    const app = express();
    app.use(express.json());

    const viewset = new TodoViewSet();
    const adapter = new ExpressAdapter();

    adapter.registerViewSet(app, '/api/todos', viewset);
}
```

`registerViewSet(...)` is the application-facing CRUD helper. It registers collection routes at `/api/todos` and detail routes at `/api/todos/:id`, then calls `list`, `create`, `retrieve`, `update`, and `destroy` on the viewset instance as requests come in.

`ExpressAdapter` also exposes `toQueryParams(req)` for application code that wants the same normalized query contract resources use internally. That helper returns `TangoQueryParams` from `@danceroutine/tango-core` and stays focused on Express-to-Tango normalization.

## Public API

The root export includes:

- `ExpressAdapter`, the main integration class
- `AdaptExpressOptions`, for adapter configuration
- route-facing helper types such as `ExpressAPIView`, `ExpressCrudViewSet`, and `ExpressRouteRegistrar`

You can import from the package root or from the `adapter` subpath:

```ts
import { ExpressAdapter } from '@danceroutine/tango-adapters-express';
import { adapter } from '@danceroutine/tango-adapters-express';
```

## Documentation

The official documentation walks through Tango from first principles and gives the clearest starting point when you are evaluating the framework or building with it.

- Official documentation: <https://tangowebframework.dev>
- Blog API tutorial: <https://tangowebframework.dev/tutorials/express-blog-api>
- Resources topic: <https://tangowebframework.dev/topics/resources-and-viewsets>
- Serializers topic: <https://tangowebframework.dev/topics/serializers>

## Development

```bash
pnpm --filter @danceroutine/tango-adapters-express build
pnpm --filter @danceroutine/tango-adapters-express typecheck
pnpm --filter @danceroutine/tango-adapters-express test
```

For the wider contributor workflow, use:

- <https://tangowebframework.dev/contributors/contributing-code>

## License

MIT
