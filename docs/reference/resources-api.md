# Resources API

`@danceroutine/tango-resources` provides Tango's HTTP-facing resource layer. It defines the request context passed into resource methods, the serializer classes that own request and response contracts, the class-based view surface for custom and model-backed endpoints, and the filtering and pagination contracts used by list routes.

## `RequestContext`

Every resource method receives a `RequestContext`.

`RequestContext` carries the normalized Tango request object (`TangoRequest`), any request-scoped user object supplied by the adapter or middleware, and any route parameters the host adapter resolved for the request. In practice, resource code usually reads `ctx.request.queryParams` for query input, `await ctx.request.json()` for request bodies, `ctx.params` for path parameters, and `ctx.user` when request handling depends on user state.

The class also provides request-local state helpers. `setState(...)`, `getState(...)`, and `hasState(...)` let middleware or adapter code attach data that later resource methods can read during the same request. `clone()` preserves the request, user, params, and stored state when a downstream layer needs a derived context.

Adapters and tests usually construct contexts with `RequestContext.create(request, user?)`. That helper wraps a standard `Request` in Tango's normalized request type before the resource layer sees it.

## Serializers

Tango keeps request validation, partial-update validation, and outward representation on serializer classes. They are the resource-layer contract for turning unknown request input into validated application data, and for turning saved records back into response shapes.

### `Serializer`

Use `Serializer<TCreateSchema, TUpdateSchema, TOutputSchema>` when an endpoint owns validation and representation, but the persistence workflow belongs to the endpoint itself rather than to `model.objects`.

Application code supplies three static schemas: `createSchema` for create payloads, `updateSchema` for update payloads, and `outputSchema` for the response shape. The instance API then lets the endpoint read those schemas, validate unknown input, and serialize records back through the output contract.

### `ModelSerializer`

Use `ModelSerializer<TModel, ...>` when the resource should persist through `model.objects`.

In addition to the three serializer schemas, application code supplies a static `model`. From there, the serializer can expose `getModel()` and `getManager()`, and its built-in `create(input)` and `update(id, input)` methods can validate the payload, run serializer hooks, call the model manager, and serialize the saved record back through `outputSchema`.

`beforeCreate(data)` and `beforeUpdate(id, data)` are the main serializer-level extension points. They fit request-scoped normalization that belongs to one resource workflow. Rules that should run whenever the record is created or updated belong on the model layer instead.

`GenericAPIView` and `ModelViewSet` both expect a `ModelSerializer` class. Endpoints without a model-backed persistence workflow should use `APIView` and call the serializer directly.

## `APIView`

When an endpoint needs custom request handling, Tango starts with `APIView`.

`APIView` is the plain class-based resource base class. Override whichever HTTP methods the endpoint supports: `get(ctx)`, `post(ctx)`, `put(ctx)`, `patch(ctx)`, or `delete(ctx)`. The public `dispatch(ctx)` method resolves the incoming HTTP method and forwards the request to the matching handler. `getAllowedMethods()` reports the handlers the subclass actually implements, and unsupported methods return `405 Method Not Allowed`.

Use `APIView` for endpoints that do not fit Tango's model-backed CRUD flow, or for endpoints that need to orchestrate serializers, queries, or external calls manually.

## `GenericAPIView`

When a resource should stay class-based but use Tango's standard model-backed workflows, use `GenericAPIView<TModel, TSerializer>`.

`GenericAPIView` centralizes the shared mechanics for listing, creating, retrieving, updating, and destroying model-backed resources. Subclasses, mixins, and concrete generic classes bind those workflows to HTTP methods.

Application code supplies that behavior through `GenericAPIViewConfig`. `serializer` is required and must be a `ModelSerializer` class. The remaining options shape how the resource behaves at the HTTP layer: `filters`, `orderingFields`, and `searchFields` control the public list-query contract; `lookupField` and `lookupParam` control how the detail route resolves one record; and `paginatorFactory` replaces the default `OffsetPaginator`.

Without overrides, `GenericAPIView` uses the model primary key and expects that value to arrive in an `id` route parameter.

Once configured, the class exposes `getSerializerClass()`, `getSerializer()`, and `describeOpenAPI()` for callers that need to inspect the resource contract. Subclasses and mixins usually build on the protected workflow helpers `performList(ctx)`, `performCreate(ctx)`, `performRetrieve(ctx)`, `performUpdate(ctx)`, and `performDestroy(ctx)`.

### Concrete generic classes

If the resource shape already matches one of Tango's standard CRUD combinations, use one of the concrete generic classes instead of wiring the HTTP methods yourself.

The exported concrete classes are:

- `ListAPIView`
- `CreateAPIView`
- `RetrieveAPIView`
- `ListCreateAPIView`
- `RetrieveUpdateAPIView`
- `RetrieveDestroyAPIView`
- `RetrieveUpdateDestroyAPIView`

For example, `ListCreateAPIView` already binds `GET` to the shared list workflow and `POST` to the shared create workflow:

```ts
class BlogPostListCreateAPIView extends ListCreateAPIView<
    BlogPostRecord,
    typeof BlogPostSerializer
> {
    constructor() {
        super({
            serializer: BlogPostSerializer,
            filters: blogPostFilters,
            orderingFields: ['createdAt', 'title'],
            searchFields: ['title'],
        });
    }
}
```

The other concrete generic classes follow the same idea. Pick the class whose built-in HTTP method combination already matches the resource you need.

### CRUD mixins

Tango also exports the single-workflow mixin base classes `ListModelMixin`, `CreateModelMixin`, `RetrieveModelMixin`, `UpdateModelMixin`, and `DestroyModelMixin`.

Use these when one workflow is the part you want to inherit directly, or when you are defining your own intermediate base class around one of the shared generic behaviors.

```ts
class BlogPostListAPIView extends ListModelMixin<
    BlogPostRecord,
    typeof BlogPostSerializer
> {
    constructor() {
        super({
            serializer: BlogPostSerializer,
            filters: blogPostFilters,
            orderingFields: ['createdAt', 'title'],
            searchFields: ['title'],
        });
    }
}
```

Each mixin wires one HTTP workflow to the corresponding protected helper on `GenericAPIView`. For example, `ListModelMixin` routes `GET` requests through `performList(ctx)`, while `CreateModelMixin` routes `POST` requests through `performCreate(ctx)`.

## `ModelViewSet`

When one class should own both the collection route and the detail route for a model-backed resource, use `ModelViewSet<TModel, TSerializer>`.

`ModelViewSet` takes a `ModelViewSetConfig` that mirrors the list-query portion of `GenericAPIView`. `serializer` is required. `filters`, `orderingFields`, and `searchFields` shape the public list-query contract. `paginatorFactory` replaces the default `OffsetPaginator`.

The built-in detail actions use the model primary key and receive the route id directly as an argument, so viewsets do not expose the `lookupField` and `lookupParam` options that `GenericAPIView` does.

The base class implements the standard action methods `list(ctx)`, `retrieve(ctx, id)`, `create(ctx)`, `update(ctx, id)`, and `destroy(ctx, id)`. Instance code can inspect the resource through `getSerializerClass()`, `getSerializer()`, and `describeOpenAPI()`. The class also provides the static helpers `isModelViewSet(...)`, `getActions(...)`, and `defineViewSetActions(...)`.

### Custom actions

Custom viewset actions are declared on the class with `ModelViewSet.defineViewSetActions(...)`. In the example below, the resource serves blog posts. Each action declaration names the instance method, whether the route applies to one record or the whole collection, which HTTP methods it accepts, and an optional path override.

```ts
class BlogPostViewSet extends ModelViewSet<BlogPostRecord, typeof BlogPostSerializer> {
    static readonly actions = ModelViewSet.defineViewSetActions([
        { name: 'publish', scope: 'detail', methods: ['POST'] },
        { name: 'recent', scope: 'collection', methods: ['GET'], path: 'recent-posts' },
    ]);

    async publish(ctx: RequestContext, id: string) {
        // ...
    }

    async recent(ctx: RequestContext) {
        // ...
    }
}
```

Adapters route each descriptor to the instance method with the same name. `scope: 'detail'` creates a route below the detail resource path, and `scope: 'collection'` creates a route below the collection path. If `path` is omitted, Tango derives it from the action name.

## `FilterSet`

`FilterSet<T>` gives a list endpoint an explicit public query contract and translates the accepted query parameters into ORM filter fragments.

Most application code starts with `FilterSet.define(...)`. `fields` exposes direct field-based filters such as `status`, `status__in`, or `createdAt__gte`. `aliases` exposes API-level names that can map to one field, several fields, or a custom resolver. `parsers` converts raw query-string input into typed filter values before they reach the ORM. `all: '__all__'` enables direct passthrough of field lookups and only fits resources whose public query contract is meant to mirror model lookups closely.

After declaration, `apply(params)` turns query parameters into ORM filter inputs. `withFieldParsers(...)` layers in parser-aware field handling, and `FilterSet.isFilterSet(...)` is the package type guard.

## Pagination

List resources use `OffsetPaginator` by default. It reads `limit`, `offset`, and `page`, applies the resulting slice to a queryset, and produces an offset-style response envelope with `results`, `count`, and `next` and `previous` links when a total count is available.

Use `CursorPaginator` when forward navigation should remain stable while rows are inserted or reordered. It reads `limit`, `cursor`, and `ordering`, applies the cursor boundary to the queryset, and returns a cursor-style response envelope with `next` and `previous` links.

If application code builds a custom paginator factory or paginated helper, the package also exports the core pagination contracts. The main pieces are `Paginator`, `Page`, the paginated response envelope types, and the `OffsetPaginationInput` and `CursorPaginationInput` parsers.

## Related pages

- [API layer](/topics/api-layer)
- [How to work with serializers](/how-to/working-with-serializers)
- [How to build your API with viewsets](/how-to/build-your-api-with-viewsets)
- [Pagination](/how-to/pagination)
