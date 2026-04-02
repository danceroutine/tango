# @danceroutine/tango-schema

`@danceroutine/tango-schema` defines Tango models, structural metadata, and model-owned write lifecycle hooks.

A Tango model is the shared contract that the ORM, migrations, resources, OpenAPI generation, and code generation read from. The schema package keeps those layers aligned by giving them one model definition to build on.

## Install

```bash
pnpm add @danceroutine/tango-schema zod
```

## Quick start

```ts
import { z } from 'zod';
import { Model, t } from '@danceroutine/tango-schema';

const PostSchema = z.object({
    id: t.primaryKey(z.number().int()),
    title: z.string(),
    slug: z.string(),
    content: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

export const PostModel = Model({
    namespace: 'blog',
    name: 'Post',
    schema: PostSchema,
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
```

`PostModel` becomes the source of truth for:

- field metadata and primary-key identity
- relation and index metadata
- migration generation
- `Model.objects` manager attachment in the ORM
- model-owned write lifecycle hooks

## Model lifecycle hooks

Model hooks live on the model definition through `hooks`. They run inside `Model.objects`, which means the same persistence rules apply across serializers, viewsets, scripts, and direct manager usage.

Use model hooks for persistence rules such as:

- timestamp stamping
- slug generation that should apply for every write path
- default persisted values
- normalization that belongs to the record itself

The write hook surface includes:

- `beforeCreate` and `afterCreate`
- `beforeUpdate` and `afterUpdate`
- `beforeDelete` and `afterDelete`
- `beforeBulkCreate` and `afterBulkCreate`

`before*` hooks may return normalized data to persist. `after*` hooks are for observation and side effects after the write succeeds.

## How the schema package fits with serializers

Serializers stay Zod-backed and continue to own request validation, update validation, and output representation.

Model hooks serve a different role. They hold persistence rules that should run for every caller of `Model.objects`, even when the write does not come from a resource.

That split keeps the model responsible for record lifecycle behavior while the serializer stays focused on the HTTP-facing contract.

## Public API

The root export includes:

- `Model`
- `RelationBuilder`
- `ModelRegistry`
- metadata helpers such as `t`, `m`, `c`, and `i`
- model and relation domain types
- model write hook types such as `ModelWriteHooks`

The root import is the normal entrypoint for application code. The `domain` and `model` subpaths are available when you want narrower imports.

## Documentation

- Official documentation: <https://tangowebframework.dev>
- Models and schema topic: <https://tangowebframework.dev/topics/models-and-schema>
- Model lifecycle hooks topic: <https://tangowebframework.dev/topics/model-lifecycle-hooks>
- Schema API reference: <https://tangowebframework.dev/reference/schema-api>

## Development

```bash
pnpm --filter @danceroutine/tango-schema build
pnpm --filter @danceroutine/tango-schema typecheck
pnpm --filter @danceroutine/tango-schema test
```

For the wider contributor workflow, use:

- <https://tangowebframework.dev/contributors/contributing-code>

## License

MIT
