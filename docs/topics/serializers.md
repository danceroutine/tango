# Serializers

Serializers define the HTTP-facing contract for a Tango resource.

The DRF mental model carries over well: a serializer validates input, shapes output, and gives the resource one class-owned place to keep request and response behavior. Tango keeps Zod as the schema language, so the serializer works with Zod rather than introducing a second schema DSL.

## What a serializer owns

A Tango serializer supplies three schema roles:

- create input
- update input
- output representation

Those schemas stay Zod-native. The serializer adds the behavior around them:

- `deserializeCreate(...)` validates unknown create input
- `deserializeUpdate(...)` validates unknown update input
- `toRepresentation(...)` shapes a record into the outward-facing response contract

`ModelSerializer` extends that base contract with default model-backed `create(...)` and `update(...)` flows.

## `Serializer`

Use `Serializer` when the endpoint wants serializer-backed validation and representation without the default model persistence flow.

That fits endpoints that:

- call external services
- aggregate multiple data sources
- return a derived response shape
- need Zod-backed request validation but custom write behavior

## `ModelSerializer`

Use `ModelSerializer` when the resource is backed by one Tango model.

A model serializer can:

- validate create input
- validate update input
- serialize a persisted record
- create through `Model.objects.create(...)`
- update through `Model.objects.update(...)`

It also exposes `beforeCreate(...)` and `beforeUpdate(...)` for resource-scoped normalization before the manager call.

## Where serializer hooks fit

Serializer hooks are best for request and resource concerns.

Good fits include:

- trimming or normalizing request data before persistence
- applying resource-specific defaults that only make sense for one endpoint
- adapting an external request shape before handing it to the model layer
- coordinating with non-model inputs that belong to the resource contract

Model lifecycle hooks serve a different role. Use model hooks for persistence rules that should run for every caller of `Model.objects`, including serializers, scripts, and direct manager usage.

That split keeps record lifecycle behavior with the model and keeps serializer hooks focused on the HTTP-facing workflow.

## Example

```ts
import { ModelSerializer } from '@danceroutine/tango-resources';
import { z } from 'zod';
import { PostCreateSchema, PostModel, PostReadSchema, type Post } from '@/lib/models';

export class PostSerializer extends ModelSerializer<
    Post,
    typeof PostCreateSchema,
    ReturnType<typeof PostCreateSchema.partial>,
    typeof PostReadSchema
> {
    static readonly model = PostModel;
    static readonly createSchema = PostCreateSchema;
    static readonly updateSchema = PostCreateSchema.partial();
    static readonly outputSchema = PostReadSchema;

    protected override async beforeCreate(data: z.output<typeof PostCreateSchema>): Promise<Partial<Post>> {
        return {
            ...data,
            title: data.title.trim(),
        };
    }
}
```

A paired model hook can handle record lifecycle work that should apply outside the resource too:

```ts
import { Model } from '@danceroutine/tango-schema';
import { slugify } from '@/lib/slugify';

export const PostModel = Model({
    namespace: 'blog',
    name: 'Post',
    schema: PostReadSchema,
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
    },
});
```

## How serializers fit into resources

`GenericAPIView` and `ModelViewSet` are serializer-first. Application code supplies `serializer: PostSerializer` in the resource constructor, and the resource uses that serializer for:

- create validation
- update validation
- output shaping
- default create and update workflows
- OpenAPI schema introspection

## Choosing the right layer

Use the serializer for resource contract behavior.

Use model hooks for persistence invariants.

Use the resource or viewset for route-level orchestration.

## Related pages

- [Model lifecycle hooks](/topics/model-lifecycle-hooks)
- [Build a model-backed serializer](/how-to/build-a-model-serializer)
- [Move persistence rules into model hooks](/how-to/move-persistence-rules-into-model-hooks)
- [Resources and viewsets](/topics/resources-and-viewsets)
