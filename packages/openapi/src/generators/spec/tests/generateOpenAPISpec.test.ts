import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { TangoResponse } from '@danceroutine/tango-core';
import type { QuerySet } from '@danceroutine/tango-orm';
import { aManager } from '@danceroutine/tango-testing';
import {
    APIView,
    GenericAPIView,
    ListAPIView,
    ListCreateAPIView,
    ModelSerializer,
    ModelViewSet,
    RetrieveUpdateAPIView,
    RetrieveUpdateDestroyAPIView,
    type RequestContext,
    type ViewSetActionDescriptor,
} from '@danceroutine/tango-resources';
import { describeAPIView, describeGenericAPIView, describeViewSet } from '../../../domain/index';
import { generateOpenAPISpec } from '../generateOpenAPISpec';

type UserRecord = {
    id: number;
    email: string;
    name: string;
};

const userReadSchema = z.object({
    id: z.number(),
    email: z.string().email(),
    name: z.string(),
});

const userWriteSchema = z.object({
    email: z.string().email(),
    name: z.string(),
});

const statusSchema = z.object({
    status: z.literal('ok'),
});

const userModel = {
    objects: aManager<UserRecord>({
        meta: { table: 'users', pk: 'id', columns: { id: 'int', email: 'text', name: 'text' } },
    }),
    metadata: {
        name: 'User',
        fields: [
            { name: 'id', type: 'serial', primaryKey: true },
            { name: 'email', type: 'text', notNull: true },
            { name: 'name', type: 'text', notNull: true },
        ],
    },
};

class UserSerializer extends ModelSerializer<
    UserRecord,
    typeof userWriteSchema,
    ReturnType<typeof userWriteSchema.partial>,
    typeof userReadSchema
> {
    static readonly model = userModel;
    static readonly createSchema = userWriteSchema;
    static readonly updateSchema = userWriteSchema.partial();
    static readonly outputSchema = userReadSchema;
}

class UserViewSet extends ModelViewSet<UserRecord, typeof UserSerializer> {
    static readonly actions = ModelViewSet.defineViewSetActions([
        {
            name: 'activateAccount',
            scope: 'detail',
            methods: ['POST'],
        },
    ]);

    protected override resolveActionPath(action: ViewSetActionDescriptor): string {
        if (action.name === 'activateAccount') {
            return 'custom-activate';
        }

        return super.resolveActionPath(action);
    }
}

class CursorUserViewSet extends ModelViewSet<UserRecord, typeof UserSerializer> {}

class RootUserViewSet extends ModelViewSet<UserRecord, typeof UserSerializer> {
    static readonly actions = ModelViewSet.defineViewSetActions([
        {
            name: 'bulkImport',
            scope: 'collection',
            methods: ['POST'],
            path: 'bulk-import',
        },
    ]);
}

class UserListOnlyView extends ListAPIView<UserRecord, typeof UserSerializer> {}

class UserListView extends ListCreateAPIView<UserRecord, typeof UserSerializer> {}

class UserUpdateView extends RetrieveUpdateAPIView<UserRecord, typeof UserSerializer> {}

class UserDetailView extends RetrieveUpdateDestroyAPIView<UserRecord, typeof UserSerializer> {}

class CreateOnlyGenericView extends GenericAPIView<UserRecord, typeof UserSerializer> {
    protected override async post(_ctx: RequestContext): Promise<TangoResponse> {
        return TangoResponse.created(undefined, { id: 1, email: 'new@example.com', name: 'New' });
    }
}

class DeleteOnlyGenericView extends GenericAPIView<UserRecord, typeof UserSerializer> {
    protected override async delete(_ctx: RequestContext): Promise<TangoResponse> {
        return TangoResponse.noContent();
    }
}

class HealthAPIView extends APIView {
    protected override async get(_ctx: RequestContext): Promise<TangoResponse> {
        return TangoResponse.json({ status: 'ok' });
    }
}

function createUnpaginatedPaginator<TResult extends Record<string, unknown>>(_queryset: QuerySet<UserRecord, TResult>) {
    return {
        parse: () => {},
        apply: <TBaseResult extends Record<string, unknown>, TSourceModel, THydrated extends Record<string, unknown>>(
            queryset: QuerySet<UserRecord, TBaseResult, TSourceModel, THydrated>
        ) => queryset,
        toResponse: (results: TResult[]) => ({ results }),
        needsTotalCount: () => false,
    };
}

describe(generateOpenAPISpec, () => {
    it('generates CRUD paths and custom action routes for a viewset', () => {
        const viewset = new UserViewSet({
            serializer: UserSerializer,
            orderingFields: ['id', 'email'],
            searchFields: ['email'],
        });

        const spec = generateOpenAPISpec({
            title: 'Users',
            version: '1.0.0',
            resources: [describeViewSet({ basePath: 'api/users', resource: viewset })],
        });

        expect(spec.paths['/api/users']?.get?.summary).toBe('List Users');
        expect(spec.paths['/api/users/{id}']?.put?.summary).toBe('Update User');
        expect(spec.paths['/api/users/{id}/custom-activate']?.post?.responses['200']?.description).toBe(
            'Successful response'
        );
        expect(spec.components?.schemas?.User?.type).toBe('object');
    });

    it('generates collection and detail generic API paths from explicit descriptors', () => {
        const collectionView = new UserListView({
            serializer: UserSerializer,
            searchFields: ['email'],
        });
        const detailView = new UserDetailView({
            serializer: UserSerializer,
            lookupField: 'email',
            lookupParam: 'email',
        });

        const spec = generateOpenAPISpec({
            title: 'Users',
            version: '1.0.0',
            resources: [
                describeGenericAPIView({
                    resource: collectionView,
                    collectionPath: '/api/generic/users',
                }),
                describeGenericAPIView({
                    resource: detailView,
                    detailPath: '/api/generic/users/{email}',
                }),
            ],
        });

        expect(spec.paths['/api/generic/users']?.get?.parameters?.some((param) => param.name === 'search')).toBe(true);
        expect(spec.paths['/api/generic/users/{email}']?.get?.parameters?.[0]?.name).toBe('email');
        expect(spec.paths['/api/generic/users/{email}']?.delete?.responses['204']?.description).toBe('Deleted');
    });

    it('rejects invalid generic descriptors that omit both collection and detail paths', () => {
        const detailView = new UserDetailView({
            serializer: UserSerializer,
        });

        expect(() =>
            generateOpenAPISpec({
                title: 'Invalid',
                version: '1.0.0',
                resources: [
                    describeGenericAPIView({
                        resource: detailView,
                    }),
                ],
            })
        ).toThrow('GenericAPIView OpenAPI descriptors require at least one of collectionPath or detailPath.');
    });

    it('validates APIView method descriptors and uses manual schemas', () => {
        const healthView = new HealthAPIView();

        const spec = generateOpenAPISpec({
            title: 'Health',
            version: '1.0.0',
            resources: [
                describeAPIView({
                    path: '/api/healthz',
                    resource: healthView,
                    methods: {
                        GET: {
                            summary: 'Health check',
                            responseSchema: statusSchema,
                        },
                    },
                }),
            ],
        });

        expect(spec.paths['/api/healthz']?.get?.summary).toBe('Health check');
        const responseSchema = spec.paths['/api/healthz']?.get?.responses['200']?.content?.['application/json']?.schema;
        expect((responseSchema as { properties?: Record<string, unknown> }).properties?.status).toBeDefined();

        expect(() =>
            generateOpenAPISpec({
                title: 'Invalid',
                version: '1.0.0',
                resources: [
                    describeAPIView({
                        path: '/api/healthz',
                        resource: healthView,
                        methods: {
                            POST: {
                                summary: 'Broken health check',
                            },
                        },
                    }),
                ],
            })
        ).toThrow("APIView method 'POST' is not implemented on HealthAPIView.");
    });

    it('uses Zod-derived request and response schemas for resource-backed operations', () => {
        const viewset = new UserViewSet({ serializer: UserSerializer });

        const spec = generateOpenAPISpec({
            title: 'Users',
            version: '1.0.0',
            resources: [describeViewSet({ basePath: '/api/users', resource: viewset })],
        });

        const requestSchema = spec.paths['/api/users']?.post?.requestBody?.content?.['application/json']?.schema as {
            properties?: Record<string, unknown>;
        };
        const responseSchema = spec.paths['/api/users']?.post?.responses['201']?.content?.['application/json']
            ?.schema as {
            properties?: Record<string, unknown>;
        };

        expect(requestSchema.properties?.email).toBeDefined();
        expect(responseSchema.properties?.id).toBeDefined();
    });

    it('supports root collection paths and collection custom actions', () => {
        const viewset = new RootUserViewSet({ serializer: UserSerializer });

        const spec = generateOpenAPISpec({
            title: 'Users',
            version: '1.0.0',
            resources: [describeViewSet({ basePath: '/', resource: viewset })],
        });

        expect(spec.paths['/']?.get?.summary).toBe('List Users');
        expect(spec.paths['/{id}']?.get?.summary).toBe('Get User');
        expect(spec.paths['/bulk-import']?.post?.summary).toBe('Bulk Import');
    });

    it('omits offset pagination params when a custom paginator factory is configured', () => {
        const viewset = new CursorUserViewSet({
            serializer: UserSerializer,
            paginatorFactory: (queryset) => createUnpaginatedPaginator(queryset),
        });

        const spec = generateOpenAPISpec({
            title: 'Users',
            version: '1.0.0',
            resources: [describeViewSet({ basePath: '/api/users', resource: viewset })],
        });

        const parameterNames = spec.paths['/api/users']?.get?.parameters?.map((parameter) => parameter.name) ?? [];
        expect(parameterNames).not.toContain('limit');
        expect(parameterNames).not.toContain('offset');
    });

    it('documents allowed generic methods for collection-only and detail-only resources', () => {
        const collectionOnly = new UserListOnlyView({ serializer: UserSerializer });
        const detailOnly = new DeleteOnlyGenericView({ serializer: UserSerializer });
        const updateOnly = new UserUpdateView({ serializer: UserSerializer });
        const createOnly = new CreateOnlyGenericView({ serializer: UserSerializer });

        const spec = generateOpenAPISpec({
            title: 'Users',
            version: '1.0.0',
            resources: [
                describeGenericAPIView({
                    resource: collectionOnly,
                    collectionPath: '/api/list-only/users',
                }),
                describeGenericAPIView({
                    resource: createOnly,
                    collectionPath: '/api/create-only/users',
                }),
                describeGenericAPIView({
                    resource: updateOnly,
                    detailPath: '/api/update-only/users/{id}',
                }),
                describeGenericAPIView({
                    resource: detailOnly,
                    detailPath: '/api/delete-only/users/{id}',
                }),
            ],
        });

        expect(spec.paths['/api/list-only/users']?.post).toBeUndefined();
        expect(spec.paths['/api/create-only/users']?.post?.summary).toBe('Create User');
        expect(spec.paths['/api/update-only/users/{id}']?.patch?.summary).toBe('Update User');
        expect(spec.paths['/api/delete-only/users/{id}']?.delete?.responses['204']?.description).toBe('Deleted');
    });

    it('applies explicit response overrides for custom viewset actions', () => {
        const viewset = new UserViewSet({ serializer: UserSerializer });

        const spec = generateOpenAPISpec({
            title: 'Users',
            version: '1.0.0',
            resources: [
                describeViewSet({
                    basePath: '/api/users',
                    resource: viewset,
                    actions: {
                        activateAccount: {
                            responses: {
                                '202': {
                                    description: 'Accepted',
                                    schema: statusSchema,
                                },
                            },
                        },
                    },
                }),
            ],
        });

        expect(spec.paths['/api/users/{id}/custom-activate']?.post?.responses['202']?.description).toBe('Accepted');
    });

    it('applies response status overrides for manual APIView metadata', () => {
        const spec = generateOpenAPISpec({
            title: 'Health',
            version: '1.0.0',
            resources: [
                describeAPIView({
                    path: '/api/healthz',
                    resource: new HealthAPIView(),
                    methods: {
                        GET: {
                            summary: 'Health check',
                            responseStatus: '204',
                            responseDescription: 'Healthy without body',
                        },
                    },
                }),
            ],
        });

        expect(spec.paths['/api/healthz']?.get?.responses['204']?.description).toBe('Healthy without body');
    });

    it('applies default status response overrides when only a description is provided', () => {
        const spec = generateOpenAPISpec({
            title: 'Health',
            version: '1.0.0',
            resources: [
                describeAPIView({
                    path: '/api/healthz',
                    resource: new HealthAPIView(),
                    tags: ['health'],
                    methods: {
                        GET: {
                            summary: 'Health check',
                            responseDescription: 'Healthy',
                        },
                    },
                }),
            ],
        });

        expect(spec.paths['/api/healthz']?.get?.responses['200']?.description).toBe('Healthy');
        expect(spec.paths['/api/healthz']?.get?.tags).toEqual(['health']);
    });

    it('applies response-schema-only overrides', () => {
        const spec = generateOpenAPISpec({
            title: 'Health',
            version: '1.0.0',
            resources: [
                describeAPIView({
                    path: '/api/healthz',
                    resource: new HealthAPIView(),
                    methods: {
                        GET: {
                            summary: 'Health check',
                            responseSchema: statusSchema,
                        },
                    },
                }),
            ],
        });

        const schema = spec.paths['/api/healthz']?.get?.responses['200']?.content?.['application/json']?.schema as {
            properties?: Record<string, unknown>;
        };
        expect(schema.properties?.status).toBeDefined();
    });

    it('rejects generic detail paths that omit the lookup parameter', () => {
        const detailView = new UserDetailView({
            serializer: UserSerializer,
            lookupField: 'email',
            lookupParam: 'email',
        });

        expect(() =>
            generateOpenAPISpec({
                title: 'Invalid',
                version: '1.0.0',
                resources: [
                    describeGenericAPIView({
                        resource: detailView,
                        detailPath: '/api/generic/users/{id}',
                    }),
                ],
            })
        ).toThrow("GenericAPIView detail paths must include '{email}', received '/api/generic/users/{id}'.");
    });

    it('rejects empty and Express-style OpenAPI paths', () => {
        expect(() =>
            generateOpenAPISpec({
                title: 'Invalid',
                version: '1.0.0',
                resources: [
                    describeAPIView({
                        path: '   ',
                        resource: new HealthAPIView(),
                        methods: {
                            GET: {
                                summary: 'Health check',
                            },
                        },
                    }),
                ],
            })
        ).toThrow('OpenAPI paths must not be empty.');

        expect(() =>
            generateOpenAPISpec({
                title: 'Invalid',
                version: '1.0.0',
                resources: [
                    describeAPIView({
                        path: '/api/users/:id',
                        resource: new HealthAPIView(),
                        methods: {
                            GET: {
                                summary: 'Health check',
                            },
                        },
                    }),
                ],
            })
        ).toThrow("OpenAPI paths must use {param} syntax, received '/api/users/:id'.");
    });

    it('accepts raw schema objects and reference objects in manual overrides', () => {
        const spec = generateOpenAPISpec({
            title: 'Health',
            version: '1.0.0',
            resources: [
                describeAPIView({
                    path: '/api/healthz',
                    resource: new HealthAPIView(),
                    methods: {
                        GET: {
                            summary: 'Health check',
                            responseSchema: {
                                $ref: '#/components/schemas/Health',
                            },
                            requestBody: {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        verbose: { type: 'boolean' },
                                    },
                                },
                            },
                        },
                    },
                }),
            ],
        });

        const operation = spec.paths['/api/healthz']?.get;
        expect(operation?.responses['200']?.content?.['application/json']?.schema).toEqual({
            $ref: '#/components/schemas/Health',
        });
        expect(operation?.requestBody?.content?.['application/json']?.schema).toEqual({
            type: 'object',
            properties: {
                verbose: { type: 'boolean' },
            },
        });
    });

    it('omits paginated envelopes for generic views with custom paginator factories', () => {
        const view = new UserListView({
            serializer: UserSerializer,
            paginatorFactory: (queryset) => createUnpaginatedPaginator(queryset),
        });

        const spec = generateOpenAPISpec({
            title: 'Users',
            version: '1.0.0',
            resources: [
                describeGenericAPIView({
                    resource: view,
                    collectionPath: '/api/generic/users',
                }),
            ],
        });

        const responseContent = spec.paths['/api/generic/users']?.get?.responses['200']?.content;
        expect(responseContent).toBeUndefined();
    });

    it('supports override response maps without schemas', () => {
        const viewset = new UserViewSet({ serializer: UserSerializer });

        const spec = generateOpenAPISpec({
            title: 'Users',
            version: '1.0.0',
            resources: [
                describeViewSet({
                    basePath: '/api/users',
                    resource: viewset,
                    actions: {
                        activateAccount: {
                            responses: {
                                '202': {
                                    description: 'Accepted without body',
                                },
                            },
                        },
                    },
                }),
            ],
        });

        expect(spec.paths['/api/users/{id}/custom-activate']?.post?.responses['202']?.content).toBeUndefined();
    });

    it('falls back to the APIView tag when a custom APIView has no constructor name', () => {
        const spec = generateOpenAPISpec({
            title: 'Health',
            version: '1.0.0',
            resources: [
                describeAPIView({
                    path: '/api/healthz',
                    resource: new (class extends APIView {
                        protected override async get(_ctx: RequestContext): Promise<TangoResponse> {
                            return TangoResponse.json({ status: 'ok' });
                        }
                    })(),
                    methods: {
                        GET: {
                            summary: 'Health check',
                        },
                    },
                }),
            ],
        });

        expect(spec.paths['/api/healthz']?.get?.tags).toEqual(['APIView']);
    });
});
