# Move persistence rules into model hooks

Use model hooks when a persistence rule should keep running outside one serializer or one resource.

This is a good refactor when a serializer has accumulated logic such as slug generation, timestamp stamping, or persisted defaults that belong to the record lifecycle.

## 1. Identify the rule

A persistence rule belongs in a model hook when you want it to apply across:

- viewsets
- generic API views
- scripts
- direct `Model.objects` usage

A serializer hook remains appropriate when the logic only exists to normalize one resource's incoming request data.

## 2. Start from the serializer

Suppose a serializer currently owns slug and timestamp behavior:

```ts
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

    protected override async beforeCreate(data: z.output<typeof PostCreateSchema>): Promise<Partial<Post>> {
        const now = new Date().toISOString();

        return {
            ...data,
            slug: data.slug ?? slugify(data.title),
            createdAt: now,
            updatedAt: now,
        };
    }
}
```

## 3. Move the rule to the model

Put the persistence behavior on the model through `hooks`.

```ts
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

## 4. Simplify the serializer

Once the model owns the persistence rule, the serializer can focus on the resource contract.

```ts
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

## 5. Keep serializer hooks for request-scoped behavior

If the resource still needs request-specific normalization, keep that in the serializer.

Examples include:

- trimming user input before persistence
- adapting one endpoint's request shape
- transforming non-model request fields before they reach the manager

## 6. Verify the wider write surface

After moving the rule to the model, check the write paths that benefit from the change:

- resource create and update flows
- custom actions that call `Model.objects.update(...)`
- scripts or bootstrap code that call `Model.objects.create(...)`
- direct manager calls in tests

That confirms the rule has moved to the shared persistence layer instead of staying attached to one endpoint.

## Related pages

- [Model lifecycle hooks](/topics/model-lifecycle-hooks)
- [Serializers](/topics/serializers)
- [Build a model-backed serializer](/how-to/build-a-model-serializer)
