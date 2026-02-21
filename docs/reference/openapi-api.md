# OpenAPI API

`@danceroutine/tango-openapi` generates OpenAPI 3.1 documents from Tango resource instances. The package builds a JSON-serializable document object and leaves publication to the host framework.

## `generateOpenAPISpec()`

`generateOpenAPISpec()` is the main entrypoint. Application code supplies document metadata such as `title`, `version`, `description`, and `servers`, then passes a `resources` array built from descriptor helpers.

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

The generator normalizes descriptor paths to OpenAPI syntax, registers component schemas, and emits operations based on the resource type.

## `describeViewSet()`

`describeViewSet({ basePath, resource, ... })` documents a `ModelViewSet`.

The generator uses the resource's OpenAPI description to emit:

- `GET /<basePath>`
- `POST /<basePath>`
- `GET /<basePath>/{id}`
- `PUT /<basePath>/{id}`
- `PATCH /<basePath>/{id}`
- `DELETE /<basePath>/{id}`

When the viewset defines custom actions, the generator also emits those routes using the resolved action paths from the resource itself. Per-action OpenAPI overrides can refine summaries, request bodies, or responses when an action needs more detail than the default structural route description.

## `describeGenericAPIView()`

`describeGenericAPIView()` documents a `GenericAPIView` resource. Application code supplies the explicit collection and detail paths that the host framework exposes.

```ts
import { describeGenericAPIView } from '@danceroutine/tango-openapi';
import { PostDetailAPIView } from './views/PostDetailAPIView';

describeGenericAPIView({
    resource: new PostDetailAPIView(),
    detailPath: '/api/posts-generic/{id}',
});
```

The generator uses the resource's allowed methods and lookup metadata to document the supported operations on those paths.

## `describeAPIView()`

`describeAPIView()` covers plain `APIView` endpoints. Because a plain `APIView` can contain arbitrary behavior, application code supplies the per-method OpenAPI metadata explicitly.

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

The generator validates those documented methods against `resource.getAllowedMethods()` before adding them to the document.

## `generateSchemaFromModel()`

`generateSchemaFromModel()` maps an `OpenAPIModel` into a schema object suitable for `components.schemas`.

Use it when an application needs schema generation separately from full document generation, or when a custom tool wants a model-derived schema without building a full OpenAPI document.

## `generateSchemaFromZod()`

`generateSchemaFromZod()` converts a Zod schema into an OpenAPI schema object.

The resource-aware generator uses this internally for request and response bodies derived from serializer output, create, and update schemas. Application code can also use it directly when building explicit `describeAPIView()` overrides.

## `mapTypeToOpenAPI()`

`mapTypeToOpenAPI()` maps Tango-style field type names to OpenAPI type names. Common SQL-oriented field names such as `serial`, `int`, `text`, `uuid`, `bool`, and `jsonb` are covered out of the box. Unknown types fall back to `string`.

## `OpenAPISpec`

`OpenAPISpec` is the document shape returned by the generator. The returned object is ready for:

- `Response.json(...)`
- Express `res.json(...)`
- writing to disk for code generation or validation
- passing into documentation tooling that expects an OpenAPI object

## Current boundary

The package follows Tango resource metadata and covers the standard CRUD surface, generic view routes, pagination and list-query basics, and custom action paths. Plain `APIView` endpoints still rely on manual operation metadata, and custom actions benefit from explicit overrides when they need detailed request or response documentation.

## Related pages

- [Publish an OpenAPI document](/how-to/publish-openapi-document)
- [Resources API](/reference/resources-api)
- [Models and schema](/topics/models-and-schema)
