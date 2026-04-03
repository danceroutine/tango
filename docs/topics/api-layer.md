# API layer

The model layer describes stored records. The ORM reads and writes those records. The API layer answers a different set of questions: which HTTP operations should exist, what input they should accept, what output they should return, which query parameters are part of the public contract, and how that contract should connect to the host framework.

That is the layer where Tango turns application data and persistence behavior into an API that clients can actually call.

## Start with one endpoint

Every API begins with an endpoint that receives an HTTP request and produces an HTTP response.

When an endpoint needs full control over that request-and-response flow, start with the smallest HTTP-facing resource class. In Tango, that class is `APIView`.

`APIView` receives Tango's adapter-neutral request context, dispatches by HTTP method, and returns a `TangoResponse` that the host adapter can translate back into the framework's normal response type. It is a good fit for endpoints such as health checks, status endpoints, webhook receivers, and other cases where the endpoint is defined more by its request and response behavior than by one model-backed CRUD lifecycle.

```ts
import { APIView, RequestContext } from '@danceroutine/tango-resources';
import { TangoResponse } from '@danceroutine/tango-core';

export class HealthAPIView extends APIView {
    protected override async get(_ctx: RequestContext): Promise<TangoResponse> {
        return TangoResponse.json({
            status: 'ok',
            source: 'api-view',
        });
    }
}
```

## API contracts begin with serializers

Most API endpoints need a stable data contract as soon as they move beyond a simple status response. The application has to decide which request payloads are valid, which update shapes are allowed, and what the response representation should look like.

In Tango, serializers own that contract. A serializer usually works with three schema roles: create input, update input, and output representation.

`Serializer` is the base class for that job. It validates incoming data and shapes outgoing data. When one Tango model owns the persistence workflow for the endpoint, `ModelSerializer` builds on the same contract and adds the default create and update path through `Model.objects`.

```ts
import { ModelSerializer } from '@danceroutine/tango-resources';
import { PostCreateSchema, PostModel, PostReadSchema, PostUpdateSchema, type Post } from '../models/index';

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

This is also one of the main boundaries in the API layer. Serializers own request-specific adaptation and representation. Persistence rules that should hold for every write belong lower in the model layer. If one endpoint accepts a convenience field, trims user input, or adapts one incoming shape into another, that work usually belongs on the serializer. If the rule should still apply when the same record is written from another endpoint or from a script, it belongs with the model instead.

## Generic views add model-backed HTTP behavior

Once an endpoint is backed by one model and one serializer, the next question is how much of the common HTTP behavior should be supplied by the framework.

Some endpoints still want explicit route wiring, or they only need one side of the CRUD surface. A list endpoint may need filtering and pagination without also needing create behavior. A detail endpoint may need retrieve and update behavior without also needing the collection route. In Tango, `GenericAPIView` is the class for that middle ground.

`GenericAPIView` keeps the view-level shape of `APIView`, but it already understands common model-backed concerns such as serializers, lookup values, filtering, ordering, search, and pagination. It is useful when the endpoint wants class-based model-backed behavior while the application still prefers to wire collection and detail routes explicitly.

In practice, application code often reaches for one of the CRUD-focused generic view subclasses built on top of `GenericAPIView`, such as `ListCreateAPIView`:

```ts
import { FilterSet, ListCreateAPIView } from '@danceroutine/tango-resources';
import { type User } from '../models/index';
import { UserSerializer } from '../serializers/index';

export class UserListCreateAPIView extends ListCreateAPIView<User, typeof UserSerializer> {
    constructor() {
        super({
            serializer: UserSerializer,
            filters: FilterSet.define<User>({
                fields: {
                    email: true,
                    username: true,
                },
            }),
            orderingFields: ['id', 'createdAt', 'username'],
            searchFields: ['email', 'username'],
        });
    }
}
```

## Viewsets keep one resource contract together

Many APIs eventually converge on the same shape. One resource needs list, create, retrieve, update, and delete behavior. The collection route and the detail route are different URLs, but they still belong to one public contract.

In Tango, `ModelViewSet` is the class for that job.

`ModelViewSet` keeps the standard CRUD behavior for one resource in one class. Application code supplies the serializer and the list-facing concerns that should be public, such as filtering, ordering, search, and pagination. The result is a resource-level contract rather than a set of unrelated route handlers that each rediscover part of the same API.

```ts
import { FilterSet, ModelViewSet } from '@danceroutine/tango-resources';
import type { Comment } from '../models/index';
import { CommentSerializer } from '../serializers/index';

export class CommentViewSet extends ModelViewSet<Comment, typeof CommentSerializer> {
    constructor() {
        super({
            serializer: CommentSerializer,
            filters: FilterSet.define<Comment>({
                fields: {
                    postId: true,
                    authorId: true,
                },
                aliases: {
                    q: { fields: ['content'], lookup: 'icontains' },
                },
            }),
            orderingFields: ['id', 'createdAt'],
            searchFields: ['content'],
        });
    }
}
```

## Filtering and pagination belong to the public API contract

List endpoints introduce another layer of design work. The application is no longer deciding only which rows match a query. It is also deciding which query parameters clients are allowed to send, which ordering rules are public, and how clients are supposed to move through the result set.

Filtering and pagination therefore sit in the API layer even though they eventually affect the queryset.

`FilterSet` defines which query parameters are accepted and how they map onto the resource's stored fields. Paginators define how the client moves through the list once those rows have been selected. Ordering rules decide whether that traversal stays stable and predictable.

```ts
import { CursorPaginator, FilterSet } from '@danceroutine/tango-resources';
import type { Comment } from '../models/index';

const filters = FilterSet.define<Comment>({
    fields: {
        postId: true,
        authorId: true,
    },
    aliases: {
        q: { fields: ['content'], lookup: 'icontains' },
    },
});

const paginatorFactory = (queryset) => new CursorPaginator(queryset, 25, 'createdAt');
```

The queryset still belongs to the ORM. The public list contract belongs to the API layer.

## Adapters connect the API layer to the host framework

Express, Next.js, and Nuxt still own routing and request lifecycle behavior. Tango provides API-facing abstractions that sit behind the host framework's routes and work in tandem with that runtime.

Adapters are the connection between those two sides. They take the host framework's request object, build Tango's `RequestContext`, call the resource class, and translate the resulting `TangoResponse` back into the host framework's response type.

That translation boundary is what lets the same serializer, generic view, or viewset stay largely unchanged while the surrounding host runtime changes.

## The API layer builds on the rest of Tango

The API layer depends on the layers below it.

It uses model metadata to understand the stored record shape. It uses the ORM for reads and writes. It depends on migrations to keep the database aligned with the model contract. It can also provide much of the metadata that OpenAPI generation needs, because the resource and serializer contracts already describe a large part of the public API surface.

Once those lower layers are in place, the API layer becomes the HTTP-facing expression of that work. It is the place where Tango turns models, queries, and serializers into an interface that an HTTP client can use.

## Related pages

- [Build your API with viewsets](/how-to/build-your-api-with-viewsets)
- [Work with serializers](/how-to/working-with-serializers)
- [Work with models](/how-to/work-with-models)
- [Auto-document your API](/how-to/auto-document-your-api)
- [Resources API](/reference/resources-api)
