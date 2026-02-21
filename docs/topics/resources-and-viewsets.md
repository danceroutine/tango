# Resources and viewsets

The resource layer turns Tango's model-backed data access into HTTP behavior.

If Django gives you class-based views and Django REST Framework gives you `APIView`, generic views, serializers, and viewsets, Tango fills the same role for TypeScript applications.

## What the package exports

`@danceroutine/tango-resources` exports:

- `RequestContext`
- `APIView`
- `GenericAPIView`
- generic CRUD classes such as `ListCreateAPIView` and `RetrieveUpdateDestroyAPIView`
- `Serializer` and `ModelSerializer`
- `ModelViewSet`
- `FilterSet`
- `OffsetPaginator` and `CursorPaginator`

## `APIView`

`APIView` is the smallest class-based building block. It dispatches by HTTP method and returns `405 Method Not Allowed` for methods you do not implement.

Use `APIView` when the endpoint is not model-backed or when you want total control over the request flow.

## `Serializer` and `ModelSerializer`

Serializers define the request and response contract for a resource.

`Serializer` supplies Zod-backed validation and representation. `ModelSerializer` adds the default create and update workflow through `Model.objects`.

Serializer hooks such as `beforeCreate(...)` and `beforeUpdate(...)` are useful for resource-scoped normalization before the manager call.

Model lifecycle hooks belong to the persistence layer and continue running underneath the resource through `Model.objects`. That means serializer-backed writes still benefit from model-owned timestamping, slug generation, and other record lifecycle behavior.

## `GenericAPIView`

`GenericAPIView` builds on `APIView` and adds the model, serializer, filtering, ordering, search, lookup, and pagination hooks that most CRUD endpoints need.

It provides helper methods for:

- listing with filtering, ordering, search, and offset pagination
- creating
- retrieving by lookup field
- updating
- deleting

Application code configures:

- `serializer`
- `lookupField`
- `lookupParam`
- `filters`
- `orderingFields`
- `searchFields`

## `ModelViewSet`

`ModelViewSet` packages the standard CRUD actions into one class:

- `list`
- `retrieve`
- `create`
- `update`
- `destroy`

It also handles:

- query-string filters through `FilterSet`
- free-text search through `searchFields`
- safe ordering through `orderingFields`
- offset pagination through `OffsetPaginator`

The serializer defines the HTTP contract. The model continues to define persistence invariants through lifecycle hooks.

## Model-backed CRUD resources

### Express

```ts
import express from 'express';
import { z } from 'zod';
import '@danceroutine/tango-orm/runtime';
import { ExpressAdapter } from '@danceroutine/tango-adapters-express';
import { Model, t } from '@danceroutine/tango-schema';
import { ModelSerializer, ModelViewSet } from '@danceroutine/tango-resources';

const TodoReadSchema = z.object({
    id: z.number(),
    title: z.string(),
    completed: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

const TodoCreateSchema = TodoReadSchema.omit({ id: true, createdAt: true, updatedAt: true });
const TodoUpdateSchema = TodoCreateSchema.partial();
type Todo = z.infer<typeof TodoReadSchema>;

const TodoModel = Model({
    namespace: 'app',
    name: 'Todo',
    schema: TodoReadSchema.extend({
        id: t.primaryKey(z.number().int()),
        title: z.string(),
        completed: t.default(z.coerce.boolean(), 'false'),
    }),
    hooks: {
        async beforeCreate({ data }) {
            const now = new Date().toISOString();
            return { ...data, createdAt: now, updatedAt: now };
        },
        async beforeUpdate({ patch }) {
            return { ...patch, updatedAt: new Date().toISOString() };
        },
    },
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

    app.listen(3000);
}
```

That one call to `registerViewSet(...)` binds both collection and detail routes:

- `GET /api/todos` -> `viewset.list(ctx)`
- `POST /api/todos` -> `viewset.create(ctx)`
- `GET /api/todos/:id` -> `viewset.retrieve(ctx, id)`
- `PATCH /api/todos/:id` -> `viewset.update(ctx, id)`
- `PUT /api/todos/:id` -> `viewset.update(ctx, id)`
- `DELETE /api/todos/:id` -> `viewset.destroy(ctx, id)`

### Next.js App Router

The serializer and viewset classes stay the same in Next.js. Route binding changes through the adapter.

Create `app/api/todos/[[...tango]]/route.ts`:

```ts
import { NextAdapter } from '@danceroutine/tango-adapters-next';
import { TodoViewSet } from '@/viewsets/TodoViewSet';

const adapter = new NextAdapter();
const viewset = new TodoViewSet();

export const { GET, POST, PATCH, PUT, DELETE } = adapter.adaptViewSet(viewset, {
    paramKey: 'tango',
});
```

With that route file in place:

- `/api/todos` is the collection route
- `/api/todos/123` is the detail route

## Custom actions

`ModelViewSet` supports static action descriptors through `defineViewSetActions(...)`, which preserves literal inference while keeping the action contract readable.

```ts
import { ModelViewSet } from '@danceroutine/tango-resources';

class TodoViewSet extends ModelViewSet<Todo, typeof TodoSerializer> {
    static readonly actions = ModelViewSet.defineViewSetActions([
        {
            name: 'publish',
            scope: 'detail',
            methods: ['POST'],
            path: 'publish',
        },
    ]);
}
```

That gives the adapter enough information to register `POST /api/todos/:id/publish`.

## `RequestContext`

`RequestContext` is the adapter-neutral request object passed into resource methods.

Adapters build it from Express or Next.js request objects so the resource layer does not need framework-specific imports.

## Choosing the owning layer

Use the resource layer to:

- expose the public query and route contract
- decide which filters, ordering, search, and pagination rules are public API
- implement custom actions and endpoint orchestration

Use serializers to validate request data and shape responses.

Use model hooks when a persistence rule should keep running outside the resource layer.

## Related pages

- [Serializers](/topics/serializers)
- [Model lifecycle hooks](/topics/model-lifecycle-hooks)
- [Build a model-backed serializer](/how-to/build-a-model-serializer)
- [Move persistence rules into model hooks](/how-to/move-persistence-rules-into-model-hooks)
- [Define custom viewset actions](/how-to/custom-viewset-actions)
