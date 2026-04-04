# How to auto-document your API

If your API is already expressed through Tango resources, Tango can generate an OpenAPI 3.1 document from the same resource contract. The result is a normal JSON document that Swagger UI, client generators, contract tests, and other tooling can consume.

This works best when the application already uses Tango resource classes to define its HTTP behavior. A `ModelViewSet` or `GenericAPIView` gives the generator enough information to derive much of the document automatically. A plain `APIView` can be included in the same document too, but it needs explicit method metadata for the parts Tango cannot infer from the class alone.

## Install the OpenAPI package

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

Most applications pair it with `@danceroutine/tango-resources` and one host adapter package.

## Build a small OpenAPI module

In most applications, OpenAPI generation lives in a dedicated module such as `src/openapi.ts` or `lib/openapi.ts`. That module holds the document metadata, instantiates the resources you want to document, and returns one generated spec object.

```ts
import { z } from 'zod';
import {
    describeAPIView,
    describeGenericAPIView,
    describeViewSet,
    generateOpenAPISpec,
    type OpenAPISpec,
} from '@danceroutine/tango-openapi';
import { CommentViewSet, PostViewSet, UserViewSet } from './viewsets/index';
import { HealthAPIView, UserListCreateAPIView } from './views/index';

export function createOpenAPISpec(): OpenAPISpec {
    return generateOpenAPISpec({
        title: 'Tango Blog API',
        version: '1.0.0',
        description: 'OpenAPI document generated from Tango resource instances.',
        resources: [
            describeViewSet({ basePath: '/api/users', resource: new UserViewSet() }),
            describeViewSet({ basePath: '/api/posts', resource: new PostViewSet() }),
            describeViewSet({ basePath: '/api/comments', resource: new CommentViewSet() }),
            describeGenericAPIView({
                resource: new UserListCreateAPIView(),
                collectionPath: '/api/generic/users',
            }),
            describeAPIView({
                path: '/api/healthz',
                resource: new HealthAPIView(),
                methods: {
                    GET: {
                        summary: 'Health check',
                        responseSchema: z.object({
                            status: z.literal('ok'),
                            source: z.literal('api-view'),
                        }),
                    },
                },
            }),
        ],
    });
}
```

Once that module exists, the rest of the application only needs to publish `createOpenAPISpec()` through a normal JSON endpoint.

## Choose the right descriptor for each resource

The generator works by taking resource instances plus a small amount of route information. The three `describe...` helpers cover the three main resource styles in Tango.

### Viewsets

Use `describeViewSet({ basePath, resource })` when one resource class owns the normal collection and detail behavior for a model-backed API.

```ts
describeViewSet({
    basePath: '/api/posts',
    resource: new PostViewSet(),
});
```

From that one descriptor, Tango can document the standard CRUD surface at the collection and detail routes. If the viewset exposes custom actions, the generator also adds those action routes by reading the action metadata from the resource itself.

### Generic views

Use `describeGenericAPIView()` when the resource follows the generic resource contract but the application is wiring the routes more explicitly.

```ts
describeGenericAPIView({
    resource: new UserListCreateAPIView(),
    collectionPath: '/api/generic/users',
});
```

If the resource also has a detail route, pass `detailPath` as well. Use OpenAPI path syntax such as `/api/posts/{id}` rather than Express-style syntax such as `/api/posts/:id`.

### Plain API views

Use `describeAPIView()` for endpoints whose behavior is fully custom.

```ts
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

This is the least automatic of the three cases. Tango can verify that the view really implements the documented method, but application code still supplies the request and response details for each operation.

## Publish the document through your host framework

Once you have a `createOpenAPISpec()` function, publishing the document becomes ordinary host-framework routing.

### Express

```ts
import { createOpenAPISpec } from './openapi';

app.get('/api/openapi.json', (_req, res) => {
    res.json(createOpenAPISpec());
});
```

### Next.js App Router

Place this in `app/api/openapi/route.ts`:

```ts
import { createOpenAPISpec } from '@/lib/openapi';

export async function GET(): Promise<Response> {
    return Response.json(createOpenAPISpec());
}
```

The same pattern works in other host frameworks as well. The important part is that the generated spec is just JSON, so the framework only needs to return it from an endpoint.

## Refine document metadata and operation details

`generateOpenAPISpec()` accepts the document metadata you would expect, including `title`, `version`, `description`, and `servers`. Use those fields to describe the API as a whole and to advertise the base URLs that external tooling should see.

The default generation is strongest when the API surface is already described by Tango resources. When you need more detail than the resource contract provides, add explicit overrides:

- use `methods` overrides on `describeGenericAPIView()` when a generic resource needs more specific operation text
- use per-method metadata on `describeAPIView()` for custom endpoints
- use `actions` overrides on `describeViewSet()` when a custom action needs richer request or response documentation than the default route entry

## Related pages

- [OpenAPI API](/reference/openapi-api)
- [Build your API with viewsets](/how-to/build-your-api-with-viewsets)
- [Work with serializers](/how-to/working-with-serializers)
- [Express blog tutorial](/tutorials/express-blog-api)
- [Next.js blog tutorial](/tutorials/nextjs-blog)
