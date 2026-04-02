# @danceroutine/tango-openapi

`@danceroutine/tango-openapi` generates OpenAPI 3.1 documents from Tango resource instances. It works best when an application already expresses its HTTP contract through `ModelViewSet`, `GenericAPIView`, or `APIView`.

Applications usually keep a small `openapi.ts` module that instantiates the resources they want to document, passes them through the descriptor helpers, and serves the generated document through Express or Next.js.

## Install

```bash
pnpm add @danceroutine/tango-openapi
```

Use this package when you want to:

- generate an OpenAPI 3.1 document from Tango resources
- derive request and response schemas from Zod-backed resource contracts
- publish a JSON document to Swagger UI, client generators, or external tooling

## Quick start

```ts
import { z } from 'zod';
import {
    describeAPIView,
    describeGenericAPIView,
    describeViewSet,
    generateOpenAPISpec,
    type OpenAPISpec,
} from '@danceroutine/tango-openapi';
import { HealthAPIView, PostDetailAPIView, PostViewSet } from './resources';

export function createOpenAPISpec(): OpenAPISpec {
    return generateOpenAPISpec({
        title: 'Blog API',
        version: '1.0.0',
        description: 'OpenAPI document generated from Tango resource instances.',
        resources: [
            describeViewSet({
                basePath: '/api/posts',
                resource: new PostViewSet(),
            }),
            describeGenericAPIView({
                resource: new PostDetailAPIView(),
                detailPath: '/api/posts-generic/{id}',
            }),
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
            }),
        ],
    });
}
```

`describeViewSet()` documents the standard CRUD surface and any custom actions the viewset exposes. `describeGenericAPIView()` documents collection and detail routes for a generic resource. `describeAPIView()` covers fully custom endpoints where application code supplies the operation metadata directly.

The generated object is ready to publish through whichever host framework owns your HTTP layer.

Express:

```ts
import { createOpenAPISpec } from './openapi';

app.get('/api/openapi.json', (_req, res) => {
    res.json(createOpenAPISpec());
});
```

Next.js App Router:

```ts
import { createOpenAPISpec } from '@/lib/openapi';

export async function GET(): Promise<Response> {
    return Response.json(createOpenAPISpec());
}
```

## What the generator emits

For a `ModelViewSet`, `generateOpenAPISpec()` emits:

- `GET /<path>`
- `POST /<path>`
- `GET /<path>/{id}`
- `PUT /<path>/{id}`
- `PATCH /<path>/{id}`
- `DELETE /<path>/{id}`

When the viewset defines custom actions, the generator also emits those routes using the resolved action paths from the resource itself.

For `GenericAPIView`, the generator documents whichever collection and detail paths the descriptor supplies. For plain `APIView`, the generator uses the manual operation metadata passed to `describeAPIView()`.

The package also generates component schemas from Tango model metadata and Zod schemas when those are available through the resource contract.

## Current boundary

The package documents Tango resources directly and covers the built-in CRUD surface, generic view routes, and custom action paths. Richer custom action request and response details still come from explicit overrides, and plain `APIView` routes still need manual method metadata because Tango cannot infer those HTTP contracts from the class alone.

`generateSchemaFromModel()` and `generateSchemaFromZod()` remain useful when an application needs schema generation outside full document generation.

## Public API

The root export includes:

- `generateOpenAPISpec()`
- `describeViewSet()`
- `describeGenericAPIView()`
- `describeAPIView()`
- `generateSchemaFromModel()`
- `generateSchemaFromZod()`
- `mapTypeToOpenAPI()`

The root export is enough for normal application use. The `domain`, `generators`, and `mappers` subpaths are useful when you want a narrower import boundary.

## Documentation

- Official documentation: <https://tangowebframework.dev>
- Publish an OpenAPI document: <https://tangowebframework.dev/how-to/publish-openapi-document>
- OpenAPI API reference: <https://tangowebframework.dev/reference/openapi-api>
- Resources topic: <https://tangowebframework.dev/topics/resources-and-viewsets>

## Development

```bash
pnpm --filter @danceroutine/tango-openapi build
pnpm --filter @danceroutine/tango-openapi typecheck
pnpm --filter @danceroutine/tango-openapi test
```

For the wider contributor workflow, use:

- <https://tangowebframework.dev/contributors/contributing-code>

## License

MIT
