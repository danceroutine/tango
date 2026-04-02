# How to publish an OpenAPI document

`@danceroutine/tango-openapi` builds an OpenAPI 3.1 document from Tango resources, which gives an application one machine-readable API description to expose to Swagger UI, client generation, or external tooling.

## Install the package

::: code-group

```bash [npm]
npm install @danceroutine/tango-openapi
```

```bash [yarn]
yarn add @danceroutine/tango-openapi
```

```bash [pnpm]
pnpm add @danceroutine/tango-openapi
```

```bash [bun]
bun add @danceroutine/tango-openapi
```

:::

Most applications pair it with `@danceroutine/tango-resources` and a host adapter package.

## Build a small OpenAPI module

Keeping OpenAPI generation in a dedicated module keeps route code thin and makes the documented resource set easy to review.

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

That module usually does three jobs:

- centralizes document metadata such as title, version, and server information
- instantiates the resources the application wants to document
- adds explicit overrides for plain `APIView` endpoints or custom operations that need richer HTTP documentation

## Publish the document in Express

The Express example exposes the generated document as JSON:

```ts
import { createOpenAPISpec } from './openapi.js';

app.get('/api/openapi.json', (_req, res) => {
    res.json(createOpenAPISpec());
});
```

That route is enough for Swagger UI or any other tooling that expects an OpenAPI JSON endpoint.

## Publish the document in Next.js App Router

The Next.js example does the same thing through a route handler:

```ts
import { createOpenAPISpec } from '@/lib/openapi';

export async function GET(): Promise<Response> {
    return Response.json(createOpenAPISpec());
}
```

Place that code in `app/api/openapi/route.ts`.

## What the generator emits

For a `ModelViewSet`, `generateOpenAPISpec()` emits the standard CRUD surface, including `PUT` and `PATCH` detail operations. When the viewset defines custom actions, the generator also emits those action routes using the resolved paths from the resource.

For a `GenericAPIView`, the generator documents whichever collection and detail paths the descriptor supplies. The resource metadata determines which methods are valid on those paths.

For a plain `APIView`, the generator relies on the explicit per-method metadata passed to `describeAPIView()`.

## Add document metadata

`generateOpenAPISpec()` accepts the usual document metadata fields:

- `title`
- `version`
- `description`
- `servers`

`servers` is the place to describe the deployment base URLs you want the document to advertise.

## Know the current boundary

The package covers the built-in resource surface directly from Tango resources. Plain `APIView` endpoints still need explicit method metadata, and custom actions may need explicit overrides when application code wants detailed request and response documentation beyond the default structural route entry.

## Related pages

- [OpenAPI API](/reference/openapi-api)
- [Resources and viewsets](/topics/resources-and-viewsets)
- [Blog API tutorial](/tutorials/express-blog-api)
- [Next.js blog tutorial](/tutorials/nextjs-blog)
