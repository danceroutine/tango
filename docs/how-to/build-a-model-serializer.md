# Build a model-backed serializer

Use `ModelSerializer` when a Tango resource is backed by one model and the serializer should own validation, representation, and the default create or update workflow.

## 1. Define the Zod schemas

Start with the Zod schemas that describe create input, update input, and output representation.

```ts
import { z } from 'zod';

export const PostReadSchema = z.object({
    id: z.number(),
    title: z.string(),
    slug: z.string(),
    content: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

export const PostCreateSchema = z.object({
    title: z.string().min(1),
    slug: z.string().optional(),
    content: z.string().min(1),
});

export const PostUpdateSchema = PostCreateSchema.partial();
export type Post = z.output<typeof PostReadSchema>;
```

## 2. Point the serializer at the model

A model-backed serializer supplies the model plus the three Zod schemas.

```ts
import { ModelSerializer } from '@danceroutine/tango-resources';
import { PostModel } from '@/lib/models';

export class PostSerializer extends ModelSerializer<
    Post,
    typeof PostCreateSchema,
    typeof PostUpdateSchema,
    typeof PostReadSchema
> {
    static readonly model = PostModel;
    static readonly createSchema = PostCreateSchema;
    static readonly updateSchema = PostUpdateSchema;
    static readonly outputSchema = PostReadSchema;
}
```

At that point the serializer can validate create and update input, persist through `PostModel.objects`, and serialize the resulting record.

## 3. Add resource-scoped normalization when needed

Override `beforeCreate(...)` or `beforeUpdate(...)` when the resource needs request-scoped normalization before persistence.

```ts
protected override async beforeCreate(data: z.output<typeof PostCreateSchema>): Promise<Partial<Post>> {
    return {
        ...data,
        title: data.title.trim(),
    };
}
```

This is a good fit for resource-specific behavior such as trimming, adapting incoming request shape, or handling inputs that only matter for one endpoint.

## 4. Keep persistence invariants on the model

Put record lifecycle behavior on the model through `hooks` when it should apply for every caller of `Model.objects`.

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
        async beforeUpdate({ patch }) {
            return {
                ...patch,
                updatedAt: new Date().toISOString(),
            };
        },
    },
});
```

That keeps slug generation and timestamp stamping with the model instead of repeating them across resources, scripts, and direct manager usage.

## 5. Attach the serializer to a resource

`ModelViewSet` and `GenericAPIView` both accept a serializer class.

```ts
import { ModelViewSet } from '@danceroutine/tango-resources';

export class PostViewSet extends ModelViewSet<Post, typeof PostSerializer> {
    constructor() {
        super({
            serializer: PostSerializer,
            orderingFields: ['id', 'createdAt', 'updatedAt', 'title'],
            searchFields: ['title', 'content'],
        });
    }
}
```

With that configuration in place, the resource can use the serializer for create, update, output shaping, and OpenAPI metadata.

## 6. Choose the right layer for each rule

Put logic in the serializer when it belongs to the HTTP-facing resource workflow.

Put logic in model hooks when it belongs to the record lifecycle.

Keep routing and broader application orchestration in the resource, viewset, or host framework.

## Related pages

- [Serializers](/topics/serializers)
- [Model lifecycle hooks](/topics/model-lifecycle-hooks)
- [Move persistence rules into model hooks](/how-to/move-persistence-rules-into-model-hooks)
- [Resources and viewsets](/topics/resources-and-viewsets)
