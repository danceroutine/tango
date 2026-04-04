# OpenAPI API

`@danceroutine/tango-openapi` generates OpenAPI 3.1 documents from Tango resources and schema inputs.

Application code usually works with this package in one flow. First, describe each resource that should appear in the document. Then pass those descriptions into `generateOpenAPISpec(...)` to build the final OpenAPI object.

## `generateOpenAPISpec(...)`

`generateOpenAPISpec(...)` builds the final OpenAPI document. It gathers the resource descriptions, combines them with the document-level metadata, and returns a plain object that can be sent from a route handler, written to a file, or passed to downstream OpenAPI tooling.

```ts
import { describeViewSet, generateOpenAPISpec } from '@danceroutine/tango-openapi';
import { PostViewSet } from './viewsets/PostViewSet';

const spec = generateOpenAPISpec({
    title: 'Blog API',
    version: '1.0.0',
    resources: [
        describeViewSet({
            basePath: '/api/posts',
            resource: new PostViewSet(),
        }),
    ],
});
```

`OpenAPIGeneratorConfig` requires `title` and `version`. `description` and `servers` let application code fill in the usual document metadata. `resources` is where the described Tango resources go.

The return type is `OpenAPISpec`. Once the spec is built, it is ready for normal OpenAPI tooling and downstream consumers.

## `describeViewSet(...)`

Use `describeViewSet(...)` when the resource you want to document is a `ModelViewSet`. This is the case where Tango can infer the most, because the viewset already exposes the standard collection and detail surface.

```ts
import { describeViewSet } from '@danceroutine/tango-openapi';
import { PostViewSet } from './viewsets/PostViewSet';

describeViewSet({
    basePath: '/api/posts',
    resource: new PostViewSet(),
    tags: ['Posts'],
});
```

`basePath` and `resource` are the required pieces here. `basePath` is the route prefix for the resource, and `resource` is the viewset instance to inspect. `tags` groups the generated operations under one or more OpenAPI tags. `actions` lets application code refine custom action routes when the action metadata alone is not enough.

From that one resource description, Tango generates the usual collection and detail operations for the viewset:

- `GET /api/posts`
- `POST /api/posts`
- `GET /api/posts/{id}`
- `PUT /api/posts/{id}`
- `PATCH /api/posts/{id}`
- `DELETE /api/posts/{id}`

It also adds any custom action routes declared on the viewset. When a custom action needs richer OpenAPI detail than Tango can infer on its own, add an entry to `actions` keyed by the action name and supply the missing operation metadata there.

## `describeGenericAPIView(...)`

Use `describeGenericAPIView(...)` when the resource is a `GenericAPIView`. This fits routes that still follow Tango's generic resource conventions, but do not expose the full CRUD shape of a `ModelViewSet`.

```ts
import { describeGenericAPIView } from '@danceroutine/tango-openapi';
import { PostDetailAPIView } from './views/PostDetailAPIView';

describeGenericAPIView({
    resource: new PostDetailAPIView(),
    detailPath: '/api/posts-generic/{id}',
});
```

`resource` is always required. The description must also include at least one of `collectionPath` or `detailPath`, because a generic view may expose only a collection route, only a detail route, or both. `tags` works the same way it does for viewsets. `methods` lets application code refine one or more inferred operations without replacing the rest.

From that resource description, Tango reads the generic view's HTTP method surface, lookup configuration, serializer schemas, search fields, ordering fields, pagination contract, and any explicit OpenAPI metadata already declared on the view. It then builds the matching collection and detail operations.

Use OpenAPI path syntax such as `{id}` in `detailPath`. Express-style `:id` syntax is rejected. When a generic view uses a custom lookup parameter, the path should use that same name so the generated path parameter matches the resource contract.

## `describeAPIView(...)`

Use `describeAPIView(...)` when the resource is a plain `APIView`. This is the most explicit case, because a plain API view does not expose enough structured information for Tango to infer request and response metadata on its own.

```ts
import { z } from 'zod';
import { describeAPIView } from '@danceroutine/tango-openapi';
import { HealthAPIView } from './views/HealthAPIView';

describeAPIView({
    path: '/api/healthz',
    resource: new HealthAPIView(),
    methods: {
        GET: {
            summary: 'Health check',
            responseSchema: z.object({
                status: z.literal('ok'),
            }),
        },
    },
});
```

`path`, `resource`, and `methods` are all required. `path` tells Tango where the route lives. `resource` is the API view instance to inspect. `methods` is where application code supplies the operation metadata that a plain API view does not expose structurally by itself. `tags` remains optional.

Tango can still confirm that the resource implements the documented HTTP methods. What it cannot do here is infer the request body, response body, and operation detail just from the class alone, so `methods` becomes the place to supply that information.

## `OpenAPIOperationOverride`

`OpenAPIOperationOverride` is the type application code uses when Tango gets the route right but still needs help with the operation details.

You will use that same override shape in three places:

- `describeAPIView(...).methods` for plain API views
- `describeGenericAPIView(...).methods` for generic views
- `describeViewSet(...).actions` for custom viewset actions

Use `summary`, `description`, `tags`, `parameters`, and `requestBody` when the generated operation needs more explicit request-side metadata. Use `responseStatus`, `responseDescription`, and `responseSchema` when one primary response is enough. Use `responses` when the operation should document several status codes explicitly.

## Schema helpers

The lower-level schema helpers are useful when code needs the schema-mapping part of the package without generating a full OpenAPI document.

### `generateSchemaFromModel(...)`

`generateSchemaFromModel(...)` accepts a minimal model-shaped object with a `name` and field metadata, then returns the OpenAPI schema for that model. Use it when code already has Tango model metadata in hand and only needs the model-to-schema mapping step.

### `generateSchemaFromZod(...)`

`generateSchemaFromZod(...)` accepts a Zod schema and returns the corresponding OpenAPI schema object. This is the same mapper the document generator uses for serializer schemas and for explicit request or response overrides.

### `mapTypeToOpenAPI(...)`

`mapTypeToOpenAPI(...)` maps Tango field-type names such as `serial`, `int`, `text`, `uuid`, `bool`, `jsonb`, and `timestamptz` to the corresponding OpenAPI scalar or object types. Unknown field types fall back to `string`.

## Public types

A small part of the exported type surface is enough for most application code:

- `OpenAPISpec` for the final document shape
- `OpenAPIGeneratorConfig` for local helpers that build a document
- `OpenAPIOperationOverride` when refining one generated operation
- `OpenAPIResponseOverride` when defining explicit multi-status `responses`

`OpenAPIViewSetDescriptor`, `OpenAPIGenericAPIViewDescriptor`, and `OpenAPIAPIViewDescriptor` are useful when code wants to type its own resource-description helpers directly.

## Current boundary

The generator covers Tango's standard `ModelViewSet` CRUD surface, `GenericAPIView` collection and detail routes, list-query basics such as search, ordering, and default offset pagination, and custom viewset action paths.

Plain `APIView` routes still need explicit method metadata. Custom actions and generic routes may also need explicit overrides when request bodies, response bodies, or status codes go beyond what Tango can infer from the resource itself.

## Related pages

- [How to auto-document your API](/how-to/auto-document-your-api)
- [Resources API](/reference/resources-api)
- [API layer](/topics/api-layer)
