# How to work with serializers

Every API needs one layer to decide what input is accepted and what output is returned. In Tango, that layer is the serializer.

Suppose you are building a blog post API. The serializer is where you decide which fields a client may send when creating a post, which fields may change during an update, and what the post should look like when it is returned in a response.

Use this guide when an endpoint needs a clear input and output contract, and you need to decide whether that contract should stand alone or be backed by one Tango model.

## Start with the job the serializer owns

A serializer owns the HTTP-facing contract for one resource workflow.

In practical terms, that usually means three schema roles:

- create input
- update input
- output representation

Tango keeps Zod as the schema language, so start by defining those schemas in Zod. These can usually be defined at the same time that you define your model schema definition.

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

Those three schemas do not need to be identical, and they often should not be. Create input, update input, and output usually answer different HTTP questions.

## Choose the right serializer base class

Once the schemas exist, the next question is which serializer base class matches the endpoint you are building.

Use `Serializer` when the endpoint needs validation and representation, but the read or write workflow does not belong to one Tango model.

That fits cases such as:

- calling an external service
- combining several data sources into one response
- accepting request data but handling persistence in custom application code
- returning a derived or computed response shape

Use `ModelSerializer` when one Tango model owns the persistence workflow for the resource.

That is the common choice for CRUD-style resources, because the serializer can validate create and update input, persist through the model manager at `Model.objects`, and then shape the persisted record into the outward-facing response contract.

## Use `Serializer` when the endpoint is not model-backed

Begin with `Serializer` when the endpoint needs request validation and response shaping, but no default model-backed create or update flow.

Suppose the blog application has a preview endpoint that accepts draft content and returns a preview payload without writing anything to the database.

```ts
import { Serializer } from '@danceroutine/tango-resources';
import { z } from 'zod';

const PreviewCreateSchema = z.object({
    title: z.string().min(1),
    content: z.string().min(1),
});

const PreviewUpdateSchema = PreviewCreateSchema.partial();

const PreviewOutputSchema = z.object({
    title: z.string(),
    excerpt: z.string(),
});

export class PostPreviewSerializer extends Serializer<
    typeof PreviewCreateSchema,
    typeof PreviewUpdateSchema,
    typeof PreviewOutputSchema
> {
    static readonly createSchema = PreviewCreateSchema;
    static readonly updateSchema = PreviewUpdateSchema;
    static readonly outputSchema = PreviewOutputSchema;
}
```

That class now has three jobs:

- `deserializeCreate(...)` validates unknown create-style input
- `deserializeUpdate(...)` validates unknown update-style input
- `toRepresentation(...)` shapes unknown data into the response contract

Inside a custom endpoint, you would usually use the serializer in two steps: validate unknown input, then shape the response payload.

```ts
const serializer = new PostPreviewSerializer();
const input = serializer.deserializeCreate(payload);

const preview = {
    title: input.title.trim(),
    excerpt: input.content.slice(0, 140),
};

const body = serializer.toRepresentation(preview);
```

That is the right pattern when the serializer should own the HTTP contract, but the endpoint itself still owns the application workflow.

## Use `ModelSerializer` when one model owns persistence

When the resource is backed by one Tango model, move to `ModelSerializer`.

The serializer still owns the same HTTP contract, but it now gains a default create and update workflow through `Model.objects`.

```ts
import { ModelSerializer } from '@danceroutine/tango-resources';
import { PostCreateSchema, PostModel, PostReadSchema, PostUpdateSchema, type Post } from '@/models';

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

At that point the serializer can:

- validate create input
- validate update input
- create through `PostModel.objects.create(...)`
- update through `PostModel.objects.update(...)`
- shape the persisted record into the outward-facing response

For many CRUD resources, that is enough by itself.

## Add resource-scoped normalization when the request contract needs it

Sometimes the resource needs a small amount of request-specific preparation before the model manager is called.

That is what `beforeCreate(...)` and `beforeUpdate(...)` are for.

Suppose the public create endpoint is designed for API clients who know an author's email address, not the internal `authorId`, and suppose the same endpoint also exposes a convenience flag named `publishNow`.

For that endpoint, the create schema might look like this:

```ts
const PostCreateSchema = z.object({
    title: z.string().min(1),
    content: z.string().min(1),
    authorEmail: z.string().email(),
    publishNow: z.boolean().default(false),
});
```

The stored record still needs `authorId` and `published`. A serializer hook is the right place to bridge that gap, because this is request-contract behavior for one resource workflow.

```ts
import { z } from 'zod';
import { UserModel } from '@/models';

protected override async beforeCreate(data: z.output<typeof PostCreateSchema>): Promise<Partial<Post>> {
    const author = await UserModel.objects.query().filter({ email: data.authorEmail }).fetchOne();

    if (!author) {
        throw new Error('Unknown author.');
    }

    return {
        title: data.title.trim(),
        content: data.content,
        authorId: author.id,
        published: data.publishNow,
    };
}
```

That hook takes an endpoint-friendly request shape and turns it into the stored shape that the model manager expects. The value of the hook is extends beyond trimming the title by enabling the API to accept the fields that make sense for this one resource without forcing the underlying model to know about `authorEmail` or `publishNow`.

Use serializer hooks for work that belongs to the HTTP-facing resource contract, such as:

- trimming or normalizing request data
- adapting one request shape into the fields the model expects
- handling request-only inputs that make sense for one resource workflow

If another endpoint, a script, or a background job already has `authorId` and wants to write posts directly, it should not be forced through email lookup logic that only exists because of one HTTP contract. That is the reason this kind of adaptation belongs on the serializer.

## Attach the serializer to a resource

Once the serializer owns the contract you want, pass it into the resource class.

For a viewset, that looks like this:

```ts
import { ModelViewSet } from '@danceroutine/tango-resources';

export class PostViewSet extends ModelViewSet<Post, typeof PostSerializer> {
    constructor() {
        super({
            serializer: PostSerializer,
            orderingFields: ['id', 'createdAt', 'updatedAt', 'title'],
        });
    }
}
```

At that point the viewset can use the serializer for create validation, update validation, response shaping, and the default model-backed create and update workflow.

`GenericAPIView` accepts the same `serializer` option when the endpoint is narrower than a full CRUD viewset.

## Keep record lifecycle rules on the model

Serializers own the HTTP contract. Models own record lifecycle behavior that should continue to run no matter who writes the record.

Continue the same blog post example. Slug generation and timestamp stamping are not conveniences for one endpoint. They are part of what it means for a post record to be written correctly.

That makes them a model concern:

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

If those rules lived on the serializer instead, they would only run when that specific serializer handled the write. A script that calls `PostModel.objects.create(...)`, a different resource that updates the same model, or a test that seeds records directly could all bypass them.

If a rule should apply for scripts, direct manager usage, test setup, and every resource that writes the record, keep it on the model through lifecycle hooks.

That split keeps the serializer focused on request and response behavior, and keeps persistence invariants in one place.

One practical decision rule is:

- if the logic exists because one endpoint accepts or returns a particular request shape, keep it on the serializer
- if the logic exists because every valid record should obey the same write-time rule, keep it on the model

## Related pages

- [API layer](/topics/api-layer)
- [How to build your API with viewsets](/how-to/build-your-api-with-viewsets)
- [How to work with models](/how-to/work-with-models)
