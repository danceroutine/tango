# @danceroutine/tango-resources

`@danceroutine/tango-resources` provides Tango's API-layer primitives.

The resources package turns model-backed data access into HTTP behavior. It gives application code a consistent way to express CRUD endpoints, custom API views, filtering, ordering, search, pagination, and serializer-backed request and response contracts while leaving request lifecycle ownership to adapters such as Express and Next.

## Install

```bash
pnpm add @danceroutine/tango-resources
```

You will usually pair this package with `@danceroutine/tango-schema` and `@danceroutine/tango-orm`.

## What the package does inside Tango

The resource layer centers on four roles:

- `APIView` and the generic API view classes for endpoints that are not full CRUD resources
- `Serializer` and `ModelSerializer` for Zod-backed input validation, output representation, and resource-scoped normalization
- `ModelViewSet` for CRUD APIs backed by a Tango serializer
- filtering and pagination primitives that keep collection behavior consistent

Model lifecycle hooks remain part of the persistence story through `@danceroutine/tango-schema`. A serializer shapes the resource contract. A model hook shapes the record lifecycle.

Request query input reaches the resource layer through `TangoRequest.queryParams`, which exposes `TangoQueryParams` from `@danceroutine/tango-core`. That keeps filtering, search, ordering, and pagination behavior framework-agnostic while giving application code a public query helper it can reuse outside resources.

## Quick start

```ts
import { z } from 'zod';
import '@danceroutine/tango-orm/runtime';
import { FilterSet, ModelSerializer, ModelViewSet } from '@danceroutine/tango-resources';
import { Model, t } from '@danceroutine/tango-schema';

const TodoReadSchema = z.object({
    id: z.number(),
    title: z.string(),
    completed: z.coerce.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
});
const TodoCreateSchema = z.object({
    title: z.string(),
    completed: z.boolean().optional(),
});
const TodoUpdateSchema = TodoCreateSchema.partial();

type Todo = z.output<typeof TodoReadSchema>;

const TodoModel = Model({
    namespace: 'app',
    name: 'Todo',
    schema: TodoReadSchema.extend({
        id: t.primaryKey(z.number().int()),
        title: z.string(),
        completed: t.field(z.coerce.boolean()).defaultValue('false').build(),
    }),
    hooks: {
        async beforeCreate({ data }) {
            const now = new Date().toISOString();

            return {
                ...data,
                createdAt: now,
                updatedAt: now,
            };
        },
        async beforeUpdate({ patch }) {
            return {
                ...patch,
                updatedAt: new Date().toISOString(),
            };
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
            filters: FilterSet.define<Todo>({
                fields: { completed: true },
            }),
            orderingFields: ['id', 'title'],
        });
    }
}
```

Adapters wire those resource classes to host routes through helpers such as `ExpressAdapter.registerViewSet(...)` and `NextAdapter.adaptViewSet(...)`.

## Where logic belongs

Use a serializer for:

- create and update input validation
- output representation
- request-scoped normalization
- resource-specific transformation that belongs to the HTTP contract

Use model hooks for:

- timestamp stamping
- slug generation that must apply for every write path
- persistence defaults and normalization that belong to the record itself
- side effects that should run no matter which caller writes through `Model.objects`

Use the resource or viewset for:

- routing behavior
- filtering, search, and pagination policy
- custom actions and endpoint orchestration

## Public API

The root export includes:

- `RequestContext`
- `Serializer` and `ModelSerializer`
- `FilterSet`
- `OffsetPaginator`, `CursorPaginator`, and pagination contracts
- `ModelViewSet`
- `APIView`, `GenericAPIView`, and the generic CRUD-oriented view classes and mixins

Most applications start with `ModelSerializer`, `ModelViewSet`, `FilterSet`, and one paginator. The generic view stack becomes useful when an endpoint is narrower than a full CRUD resource, and `APIView` stays available for fully custom request handling.

## Import style

The package supports both root imports and domain-style imports:

```ts
import { APIView, FilterSet, ModelSerializer, ModelViewSet, OffsetPaginator } from '@danceroutine/tango-resources';
import { context, filters, pagination, serializer, view, viewset } from '@danceroutine/tango-resources';
```

Available subpaths include `context`, `filters`, `pagination`, `paginators`, `serializer`, `viewset`, `view`, and `domain`.

## Developer workflow

```bash
pnpm --filter @danceroutine/tango-resources build
pnpm --filter @danceroutine/tango-resources typecheck
pnpm --filter @danceroutine/tango-resources test
```

## Bugs and support

- Documentation: <https://tangowebframework.dev>
- API layer topic: <https://tangowebframework.dev/topics/api-layer>
- API reference: <https://tangowebframework.dev/reference/resources-api>
- Issue tracker: <https://github.com/danceroutine/tango/issues>

## License

MIT
