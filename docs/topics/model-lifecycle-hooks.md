# Model lifecycle hooks

Model lifecycle hooks let a Tango model own its write-side record lifecycle.

They run inside `Model.objects`, which means the same persistence rules apply across serializers, viewsets, scripts, and direct manager usage.

## What model hooks are for

Use model hooks for persistence behavior that belongs to the record itself.

Common examples include:

- stamping `createdAt` and `updatedAt`
- generating a slug from a title
- applying persisted defaults
- normalizing values before they are written
- running side effects after a write succeeds

## Available hooks

Tango exposes explicit write hooks:

- `beforeCreate`
- `afterCreate`
- `beforeUpdate`
- `afterUpdate`
- `beforeDelete`
- `afterDelete`
- `beforeBulkCreate`
- `afterBulkCreate`

`before*` hooks may return normalized data to persist.

`after*` hooks run after the write succeeds and return `void`.

## Example

```ts
import { Model, t } from '@danceroutine/tango-schema';
import { z } from 'zod';
import { slugify } from '@/lib/slugify';

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
                slug: data.slug ?? slugify(String(data.title)),
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

## Why model hooks live below serializers

A serializer defines the request and response contract for one resource.

A model hook defines persistence behavior for every caller of the model manager.

That difference matters when the same model is written from more than one place. A timestamp or slug rule usually belongs with the model because scripts, background jobs, admin workflows, and resources all benefit from the same behavior.

## How model hooks interact with serializers

Serializer hooks still run first in resource-driven create and update flows.

Model hooks run inside `Model.objects` during the write itself.

That ordering supports a clean split:

- serializer hooks normalize request-scoped input
- model hooks enforce persistence invariants

## Update and delete behavior

`beforeUpdate`, `afterUpdate`, `beforeDelete`, and `afterDelete` receive the current persisted record.

That gives hook code the full record context for auditing, comparison, and side effects. The manager performs the lookup before the write.

## Bulk create behavior

`bulkCreate(...)` uses both per-row and batch hooks.

The manager runs `beforeCreate` for each row first, then `beforeBulkCreate` for the normalized row array. After the insert succeeds, it runs `afterCreate` for each created row and then `afterBulkCreate` for the full result set.

## Choosing between layers

Use model hooks when the rule should run for every write path.

Use serializer hooks when the rule belongs to one resource workflow.

Use the resource or host framework when the logic is about routing, HTTP behavior, or broader orchestration.

## Related pages

- [Serializers](/topics/serializers)
- [Move persistence rules into model hooks](/how-to/move-persistence-rules-into-model-hooks)
- [Build a model-backed serializer](/how-to/build-a-model-serializer)
