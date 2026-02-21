# Resources API reference

`@danceroutine/tango-resources` defines Tango's resource-layer contracts for request dispatch, serializer-backed CRUD views, filtering, and pagination.

## Top-level exports

Most application code starts with:

- `RequestContext`
- `Serializer`
- `ModelSerializer`
- `FilterSet`
- `OffsetPaginator` or `CursorPaginator`
- `APIView`
- `GenericAPIView`
- `ModelViewSet`

The root export also includes namespace barrels, mixins, and generic CRUD view classes for cases where you want a narrower class than a full viewset.

`RequestContext.request` is a `TangoRequest`. Resource code reads normalized query input through `ctx.request.queryParams`, which exposes `TangoQueryParams` from `@danceroutine/tango-core`.

## `APIView`

`APIView` is the smallest class-based resource abstraction.

Use it when an endpoint is not naturally CRUD-oriented or when you want to control request handling method by method. Application code subclasses `APIView` and overrides whichever HTTP methods it needs, typically `get`, `post`, `put`, `patch`, or `delete`.

Requests are dispatched by HTTP method, unsupported methods return `405`, and the `Allow` header is derived from the methods your subclass actually implements.

## `Serializer`

`Serializer` is the base class for Zod-backed request and response contracts.

Application code supplies a create schema, an update schema, and an output schema. The serializer then exposes:

- `deserializeCreate(input)`
- `deserializeUpdate(input)`
- `toRepresentation(record)`

Use it when an endpoint needs Zod-backed validation and representation logic but does not want the default model-backed persistence behavior.

## `ModelSerializer`

`ModelSerializer` extends `Serializer` with default persistence through `Model.objects`.

Application code supplies the Tango model plus the create, update, and output schemas. The serializer can then:

- validate create input
- validate update input
- normalize resource-scoped input before persistence with `beforeCreate(...)` or `beforeUpdate(...)`
- perform create and update workflows through the model manager
- turn persisted records into the outward-facing representation

Use `ModelSerializer` when the resource contract is model-backed and the serializer should own the HTTP-facing workflow. Persistence invariants that should apply across all callers belong in model lifecycle hooks.

## `GenericAPIView`

`GenericAPIView` is the serializer-backed base class for generic resource views.

Use it when the endpoint is model-backed but you do not want a single class that groups every CRUD action. The generic subclasses such as `ListCreateAPIView` and `RetrieveUpdateDestroyAPIView` are built on top of it.

Application code supplies a serializer plus optional filtering, search, ordering, lookup, and paginator settings. The generic view aligns its HTTP behavior with the serializer contract and the underlying model manager.

The main extension points are the built-in helper methods:

- `performList(ctx)`
- `performCreate(ctx)`
- `performRetrieve(ctx)`
- `performUpdate(ctx)`
- `performDestroy(ctx)`

The generic CRUD subclasses call those helpers so they can share one implementation of query handling, validation, lookup behavior, and response shaping.

## `ModelViewSet`

`ModelViewSet` is an abstract base class. Application code subclasses it, passes configuration to `super(...)`, and then gives the instance to an adapter helper such as `ExpressAdapter.registerViewSet(...)`, `NextAdapter.adaptViewSet(...)`, or `NextAdapter.adaptViewSetFactory(...)`.

Use it when one class should own the full CRUD surface of a resource.

Application code supplies the serializer and any optional filtering, ordering, search, or pagination settings. The serializer defines the create, update, and output contract, while the viewset groups the route-level behavior.

The standard actions are:

- `list(ctx)`
- `retrieve(ctx, id)`
- `create(ctx)`
- `update(ctx, id)`
- `destroy(ctx, id)`

The base class implements those methods. A minimal subclass can inherit them unchanged and only define a constructor.

### `ModelViewSet.defineViewSetActions(...)`

`defineViewSetActions(...)` is the typed helper for custom action descriptors.

Use it when a viewset exposes extra collection or detail routes beyond the built-in CRUD surface. The helper preserves literal inference for methods, scope, and path while keeping the static action declaration easy to read.

## `FilterSet`

`FilterSet` translates public query parameters into model-safe filter fragments.

Use it when an endpoint should accept a stable, documented filtering contract instead of exposing raw ORM syntax through the query string. Most new application code should start with `FilterSet.define(...)`, which builds that contract from allowed fields, lookup declarations, aliases, parser hooks, and optional `__all__` behavior.

The lower-level constructor form still exists for cases that need full custom resolver logic.

## Paginators

### `OffsetPaginator`

`OffsetPaginator` is the built-in paginator for page- and offset-style traversal.

Most application code does not instantiate it directly, because the built-in list behavior in `GenericAPIView` and `ModelViewSet` already uses it. Instantiate it yourself when you want the same response contract outside those classes.

In practical terms, it does three jobs:

- read paging inputs from the request
- apply limit and offset to a `QuerySet`
- serialize the paginated response envelope

### `CursorPaginator`

`CursorPaginator` supports cursor-based traversal when forward navigation needs to remain stable as data changes.

Use it when offset pagination is not stable enough for the data you are traversing. The paginator is responsible for reading the cursor input, applying the traversal boundary to the query, and producing the response envelope that contains the next or previous cursor tokens.

## Related pages

- [Resources and viewsets](/topics/resources-and-viewsets)
- [Serializers](/topics/serializers)
- [Model lifecycle hooks](/topics/model-lifecycle-hooks)
- [Build a model-backed serializer](/how-to/build-a-model-serializer)
- [Move persistence rules into model hooks](/how-to/move-persistence-rules-into-model-hooks)
- [Define custom viewset actions](/how-to/custom-viewset-actions)
- [Filtering](/how-to/filtering)
- [Pagination](/how-to/pagination)
