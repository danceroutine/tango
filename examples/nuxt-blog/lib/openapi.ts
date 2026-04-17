import { z } from 'zod';
import {
    describeAPIView,
    describeGenericAPIView,
    describeViewSet,
    generateOpenAPISpec,
    type OpenAPISpec,
} from '@danceroutine/tango-openapi';
import { PostViewSet } from '~~/viewsets/PostViewSet';
import { EditorialOverviewAPIView, EditorialOverviewResponseSchema, PostDetailAPIView, StatusAPIView } from '~~/views';

export function createOpenAPISpec(): OpenAPISpec {
    return generateOpenAPISpec({
        title: 'Tango Nuxt Blog API',
        version: '1.0.0',
        description: 'OpenAPI document generated from Tango resource instances.',
        resources: [
            describeViewSet({ basePath: '/api/posts', resource: new PostViewSet() }),
            describeGenericAPIView({
                resource: new PostDetailAPIView(),
                detailPath: '/api/posts-generic/{id}',
            }),
            describeAPIView({
                path: '/api/editorial/overview',
                resource: new EditorialOverviewAPIView(),
                methods: {
                    GET: {
                        summary: 'Editorial overview with nested relation hydration',
                        responseSchema: EditorialOverviewResponseSchema,
                    },
                },
            }),
            describeAPIView({
                path: '/api/status',
                resource: new StatusAPIView(),
                methods: {
                    GET: {
                        summary: 'Status check',
                        responseSchema: z.object({
                            ok: z.literal(true),
                            source: z.literal('api-view'),
                        }),
                    },
                },
            }),
        ],
    });
}
