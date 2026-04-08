# @danceroutine/tango-orm

`@danceroutine/tango-orm` provides Tango's persistence layer.

The default Tango path is model-first. A Tango model can expose `Model.objects`, the runtime loads database configuration on first use, and most application code stays focused on queries and CRUD flows rather than client wiring.

## Install

```bash
pnpm add @danceroutine/tango-orm
```

Install the driver for the dialect you use:

```bash
pnpm add pg
# or
pnpm add better-sqlite3
```

## What the package does inside Tango

The package is organized around five concerns:

- `runtime`, for Tango-owned config loading and shared DB client lifecycle
- `manager`, for Django-style `Model.objects` access
- `connection`, for adapters and concrete DB clients
- `query`, for composable query state and compilation
- `transaction`, for explicit units of work

Most applications can stay inside `Model.objects` and `QuerySet`.

## Quick start

```ts
import { z } from 'zod';
import '@danceroutine/tango-orm/runtime';
import { Model, t } from '@danceroutine/tango-schema';

const TodoReadSchema = z.object({
    id: z.number(),
    title: z.string(),
    completed: z.coerce.boolean(),
});

export const TodoModel = Model({
    namespace: 'app',
    name: 'Todo',
    schema: TodoReadSchema.extend({
        id: t.primaryKey(z.number().int()),
        title: z.string(),
        completed: t.field(z.coerce.boolean()).defaultValue('false').build(),
    }),
});

const todos = await TodoModel.objects.query().orderBy('-id').fetch(TodoReadSchema);
```

The side-effect import enables Tango's runtime-backed model augmentation for the process. After that, application code can query through `Model.objects` directly.

## Main building blocks

The root export includes:

- runtime helpers such as `getTangoRuntime`
- manager contracts such as `ModelManager`
- connection helpers such as `connectDB`, `AdapterRegistry`, `PostgresAdapter`, and `SqliteAdapter`
- query primitives such as `QuerySet`, `QBuilder`, `Q`, `QueryCompiler`, `TableMeta`, and `QueryExecutor`
- `UnitOfWork`

## Import style

For most applications, root imports are the clearest choice:

```ts
import { Q, QuerySet, UnitOfWork } from '@danceroutine/tango-orm';
```

If you prefer explicit boundaries, the package also exposes `runtime`, `manager`, `connection`, `query`, and `transaction` subpaths.

## Developer workflow

```bash
pnpm --filter @danceroutine/tango-orm build
pnpm --filter @danceroutine/tango-orm typecheck
pnpm --filter @danceroutine/tango-orm test
```

The package also has integration coverage for dialect-specific behavior:

```bash
pnpm --filter @danceroutine/tango-orm test:integration
```

## Bugs and support

- Documentation: <https://tangowebframework.dev>
- ORM topic: <https://tangowebframework.dev/topics/orm-and-querysets>
- Query reference: <https://tangowebframework.dev/reference/orm-query-api>
- Issue tracker: <https://github.com/danceroutine/tango/issues>

## License

MIT
