import { z } from 'zod';
import {
    describeAPIView,
    describeGenericAPIView,
    describeViewSet,
    generateOpenAPISpec,
    type OpenAPISpec,
} from '@danceroutine/tango-openapi';
import { CommentViewSet, PostViewSet, UserViewSet } from './viewsets/index';
import {
    EditorialOverviewAPIView,
    EditorialOverviewResponseSchema,
    HealthAPIView,
    UserListCreateAPIView,
} from './views/index';

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
        ],
    });
}
