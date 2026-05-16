import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { TangoQueryParams, TangoRequest, TangoResponse } from '@danceroutine/tango-core';
import { isFrameworkAdapter } from '@danceroutine/tango-adapters-core';
import { BoundFrameworkAdapterRequestExecutor } from '@danceroutine/tango-adapters-core/adapter';
import { NextAdapter } from '..';

function jsonResponse(data: unknown, status: number = 200): TangoResponse {
    return TangoResponse.json(data as Parameters<typeof TangoResponse.json>[0], { status });
}

function emptyResponse(status: number): TangoResponse {
    return new TangoResponse({ status });
}

type BoundRequestExecutorRunner = {
    runMaterializedResponse: (
        method: string | undefined,
        transaction: 'writes' | undefined,
    ) => Promise<unknown>;
};

describe(NextAdapter, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('satisfies the shared framework adapter typeguard', () => {
        expect(isFrameworkAdapter(new NextAdapter())).toBe(true);
    });

    it('can be created without configuration', () => {
        const adapter = new NextAdapter();
        expect(adapter).toBeInstanceOf(NextAdapter);
    });

    it('normalizes Next-style search params into Tango query params', () => {
        const adapter = new NextAdapter();
        const params = adapter.toQueryParams({
            search: ' tango ',
            tag: ['orm', 'http'],
        });

        expect(TangoQueryParams.isTangoQueryParams(params)).toBe(true);
        expect(params.getSearch()).toBe('tango');
        expect(params.getAll('tag')).toEqual(['orm', 'http']);
    });

    it('adapts handlers and passes route id params when expected', async () => {
        const adapter = new NextAdapter();
        const view = vi.fn(async (_ctx: unknown, id: unknown) => jsonResponse({ id: String(id) }, 200));
        const routeHandler = adapter.adapt(view);

        const req = { url: 'http://localhost/users/42' } as unknown as NextRequest;
        const response = await routeHandler(req, { params: Promise.resolve({ id: '42' as string | string[] }) });

        expect(view).toHaveBeenCalledTimes(1);
        expect(view.mock.calls[0]?.[1]).toBe('42');
        expect(response.status).toBe(200);
    });

    it('injects user and handles route context without params', async () => {
        const adapter = new NextAdapter();
        const view = vi.fn(async (ctx) => jsonResponse({ hasUser: !!ctx.user }, 200));
        const routeHandler = adapter.adapt(view, {
            getUser: async () => ({ id: 7 }),
        });

        const req = { url: 'http://localhost/users' } as unknown as NextRequest;
        const response = await routeHandler(req, { params: Promise.resolve({}) });
        const body = await response.json();

        expect(body).toEqual({ hasUser: true });
        expect(view).toHaveBeenCalledTimes(1);
    });

    it('handles missing route context object', async () => {
        const adapter = new NextAdapter();
        const view = vi.fn(async () => jsonResponse({ ok: true }, 200));
        const routeHandler = adapter.adapt(view);

        const req = { url: 'http://localhost/users' } as unknown as NextRequest;
        const response = await routeHandler(req);
        const body = await response.json();

        expect(body).toEqual({ ok: true });
        expect(view).toHaveBeenCalledTimes(1);
    });

    it('accepts a real Request instance and normalizes it into a Tango request context', async () => {
        const adapter = new NextAdapter();
        const view = vi.fn(async (ctx) => jsonResponse({ search: ctx.request.queryParams.getSearch() }, 200));
        const routeHandler = adapter.adapt(view);

        const req = new Request('http://localhost/users?search=tango') as unknown as NextRequest;
        const response = await routeHandler(req, { params: Promise.resolve({}) });
        const body = await response.json();

        expect(body).toEqual({ search: 'tango' });
        expect(view).toHaveBeenCalledTimes(1);
    });

    it('reuses TangoRequest instances without re-wrapping them', async () => {
        const adapter = new NextAdapter();
        const view = vi.fn(async (ctx) => jsonResponse({ search: ctx.request.queryParams.getSearch() }, 200));
        const routeHandler = adapter.adapt(view);

        const req = new TangoRequest('http://localhost/users?search=tango') as unknown as NextRequest;
        const response = await routeHandler(req, { params: Promise.resolve({}) });
        const body = await response.json();

        expect(body).toEqual({ search: 'tango' });
        expect(view).toHaveBeenCalledTimes(1);
        expect(view.mock.calls[0]?.[0].request).toBe(req);
    });

    it('falls back to a localhost URL for minimal request-like stubs', async () => {
        const adapter = new NextAdapter();
        const view = vi.fn(async (ctx) => jsonResponse({ url: ctx.request.url }, 200));
        const routeHandler = adapter.adapt(view);

        const response = await routeHandler({} as NextRequest, { params: Promise.resolve({}) });
        const body = await response.json();

        expect(body).toEqual({ url: 'http://localhost/' });
        expect(view).toHaveBeenCalledTimes(1);
    });

    it('returns 500 response on handler error', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const adapter = new NextAdapter();
        const routeHandler = adapter.adapt(async () => {
            throw new Error('boom');
        });

        const req = { url: 'http://localhost/users' } as unknown as NextRequest;
        const response = await routeHandler(req, { params: Promise.resolve({}) });
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toEqual({ error: 'boom', details: null });
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('forwards the POST request method and policy to request execution support', async () => {
        const runMaterializedResponseSpy = vi
            .spyOn(
                BoundFrameworkAdapterRequestExecutor.prototype as unknown as BoundRequestExecutorRunner,
                'runMaterializedResponse'
            )
            .mockImplementation(async (_method, _transaction) => ({
                status: 201,
                statusText: 'Created',
                headers: new Headers({ 'content-type': 'application/json' }),
                body: new TextEncoder().encode(JSON.stringify({ ok: true })),
            }));
        const adapter = new NextAdapter();
        const routeHandler = adapter.adapt(async () => jsonResponse({ ok: true }, 201), { transaction: 'writes' });

        const req = { method: 'POST', url: 'http://localhost/users' } as unknown as NextRequest;
        const response = await routeHandler(req, { params: Promise.resolve({}) });

        expect(response.status).toBe(201);
        expect(runMaterializedResponseSpy).toHaveBeenCalledWith('POST', 'writes');
        runMaterializedResponseSpy.mockRestore();
    });

    it('forwards the GET request method and policy to request execution support', async () => {
        const runMaterializedResponseSpy = vi
            .spyOn(
                BoundFrameworkAdapterRequestExecutor.prototype as unknown as BoundRequestExecutorRunner,
                'runMaterializedResponse'
            )
            .mockImplementation(async (_method, _transaction) => ({
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'content-type': 'application/json' }),
                body: new TextEncoder().encode(JSON.stringify({ ok: true })),
            }));
        const adapter = new NextAdapter();
        const routeHandler = adapter.adapt(async () => jsonResponse({ ok: true }, 200), { transaction: 'writes' });

        const req = { method: 'GET', url: 'http://localhost/users' } as unknown as NextRequest;
        const response = await routeHandler(req, { params: Promise.resolve({}) });

        expect(response.status).toBe(200);
        expect(runMaterializedResponseSpy).toHaveBeenCalledWith('GET', 'writes');
        runMaterializedResponseSpy.mockRestore();
    });

    it('adapts full CRUD handlers for catch-all routes', async () => {
        const adapter = new NextAdapter();
        const viewset = {
            list: vi.fn(async () => jsonResponse({ action: 'list' }, 200)),
            create: vi.fn(async () => jsonResponse({ action: 'create' }, 201)),
            retrieve: vi.fn(async (_ctx, id: string) => jsonResponse({ action: 'retrieve', id }, 200)),
            update: vi.fn(async (_ctx, id: string) => jsonResponse({ action: 'update', id }, 200)),
            destroy: vi.fn(async () => emptyResponse(204)),
        };
        const handlers = adapter.adaptViewSet(viewset);
        const req = { url: 'http://localhost/api/posts' } as unknown as NextRequest;

        const listResponse = await handlers.GET(req, { params: Promise.resolve({}) });
        expect(listResponse.status).toBe(200);
        expect(viewset.list).toHaveBeenCalledTimes(1);

        const retrieveResponse = await handlers.GET(req, {
            params: Promise.resolve({ tango: ['123'] }),
        });
        expect(retrieveResponse.status).toBe(200);
        expect(viewset.retrieve).toHaveBeenCalledTimes(1);
        expect(viewset.retrieve.mock.calls[0]?.[1]).toBe('123');

        const createResponse = await handlers.POST(req, { params: Promise.resolve({}) });
        expect(createResponse.status).toBe(201);
        expect(viewset.create).toHaveBeenCalledTimes(1);

        const createWithId = await handlers.POST(req, {
            params: Promise.resolve({ tango: ['999'] }),
        });
        expect(createWithId.status).toBe(405);

        const patchResponse = await handlers.PATCH(req, {
            params: Promise.resolve({ tango: ['456'] }),
        });
        expect(patchResponse.status).toBe(200);
        expect(viewset.update).toHaveBeenCalledTimes(1);
        expect(viewset.update.mock.calls[0]?.[1]).toBe('456');

        const putResponse = await handlers.PUT(req, {
            params: Promise.resolve({ tango: ['789'] }),
        });
        expect(putResponse.status).toBe(200);
        expect(viewset.update).toHaveBeenCalledTimes(2);
        expect(viewset.update.mock.calls[1]?.[1]).toBe('789');

        const putWithoutId = await handlers.PUT(req, { params: Promise.resolve({}) });
        expect(putWithoutId.status).toBe(405);

        const retrieveByDirectId = await handlers.GET(req, {
            params: Promise.resolve({ id: '321' }),
        });
        expect(retrieveByDirectId.status).toBe(200);
        expect(viewset.retrieve).toHaveBeenCalledTimes(2);
        expect(viewset.retrieve.mock.calls[1]?.[1]).toBe('321');

        const deleteWithoutId = await handlers.DELETE(req, { params: Promise.resolve({}) });
        expect(deleteWithoutId.status).toBe(405);

        const deleteWithId = await handlers.DELETE(req, {
            params: Promise.resolve({ tango: ['654'] }),
        });
        expect(deleteWithId.status).toBe(204);
        expect(viewset.destroy).toHaveBeenCalledTimes(1);

        const patchWithoutId = await handlers.PATCH(req, { params: Promise.resolve({}) });
        expect(patchWithoutId.status).toBe(405);

        const retrieveWithEmptyCatchAll = await handlers.GET(req, {
            params: Promise.resolve({ tango: [''] }),
        });
        expect(retrieveWithEmptyCatchAll.status).toBe(200);
        expect(viewset.list).toHaveBeenCalledTimes(2);

        const retrieveWithSlashCatchAll = await handlers.GET(req, {
            params: Promise.resolve({ tango: ['/'] }),
        });
        expect(retrieveWithSlashCatchAll.status).toBe(200);
        expect(viewset.list).toHaveBeenCalledTimes(3);
    });

    it('adapts viewsets from lazy factories with one-time initialization', async () => {
        const adapter = new NextAdapter();
        const viewset = {
            list: vi.fn(async () => jsonResponse({ action: 'list' }, 200)),
            create: vi.fn(async () => jsonResponse({ action: 'create' }, 201)),
            retrieve: vi.fn(async (_ctx, id: string) => jsonResponse({ id }, 200)),
            update: vi.fn(async () => emptyResponse(200)),
            destroy: vi.fn(async () => emptyResponse(204)),
        };
        const factory = vi.fn(async () => viewset);

        const handlers = adapter.adaptViewSetFactory(factory, { paramKey: 'tango' });
        const req = { url: 'http://localhost/api/posts' } as unknown as NextRequest;

        const listResponse = await handlers.GET(req, { params: Promise.resolve({}) });
        expect(listResponse.status).toBe(200);
        expect(viewset.list).toHaveBeenCalledTimes(1);
        expect(factory).toHaveBeenCalledTimes(1);

        const createResponse = await handlers.POST(req, { params: Promise.resolve({}) });
        expect(createResponse.status).toBe(201);
        expect(viewset.create).toHaveBeenCalledTimes(1);
        expect(factory).toHaveBeenCalledTimes(1);
    });

    it('retries lazy viewset initialization after factory failure', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const adapter = new NextAdapter();
        const viewset = {
            list: vi.fn(async () => jsonResponse({ action: 'list' }, 200)),
            create: vi.fn(async () => jsonResponse({ action: 'create' }, 201)),
            retrieve: vi.fn(async (_ctx, id: string) => jsonResponse({ id }, 200)),
            update: vi.fn(async () => emptyResponse(200)),
            destroy: vi.fn(async () => emptyResponse(204)),
        };

        const factory = vi
            .fn<() => Promise<typeof viewset>>()
            .mockRejectedValueOnce(new Error('db-not-ready'))
            .mockResolvedValueOnce(viewset);

        const handlers = adapter.adaptViewSetFactory(factory, { paramKey: 'tango' });
        const req = { url: 'http://localhost/api/posts' } as unknown as NextRequest;

        const first = await handlers.GET(req, { params: Promise.resolve({}) });
        const firstBody = await first.json();
        expect(first.status).toBe(500);
        expect(firstBody).toEqual({ error: 'db-not-ready', details: null });
        expect(factory).toHaveBeenCalledTimes(1);

        const second = await handlers.GET(req, { params: Promise.resolve({}) });
        const secondBody = await second.json();
        expect(second.status).toBe(200);
        expect(secondBody).toEqual({ action: 'list' });
        expect(factory).toHaveBeenCalledTimes(2);
        consoleSpy.mockRestore();
    });

    it('dispatches detail and collection custom actions with method checks', async () => {
        const adapter = new NextAdapter();
        const viewset = {
            list: vi.fn(async () => jsonResponse({ action: 'list' }, 200)),
            create: vi.fn(async () => jsonResponse({ action: 'create' }, 201)),
            retrieve: vi.fn(async (_ctx, id: string) => jsonResponse({ action: 'retrieve', id }, 200)),
            update: vi.fn(async (_ctx, id: string) => jsonResponse({ action: 'update', id }, 200)),
            destroy: vi.fn(async () => emptyResponse(204)),
            activateAccount: vi.fn(async (_ctx, id: string) => jsonResponse({ action: 'activateAccount', id }, 200)),
            metrics: vi.fn(async () => jsonResponse({ action: 'metrics' }, 200)),
            constructor: {
                getActions: () =>
                    [
                        {
                            name: 'activateAccount',
                            scope: 'detail',
                            methods: ['POST'],
                            path: 'activate-account',
                        },
                        {
                            name: 'metrics',
                            scope: 'collection',
                            methods: ['GET'],
                            path: 'metrics/daily',
                        },
                    ] as const,
            },
        };

        const handlers = adapter.adaptViewSet(viewset);
        const req = { url: 'http://localhost/api/users' } as unknown as NextRequest;

        const detailAction = await handlers.POST(req, {
            params: Promise.resolve({ tango: ['123', 'activate-account'] }),
        });
        expect(detailAction.status).toBe(200);
        expect(viewset.activateAccount).toHaveBeenCalledTimes(1);
        expect(viewset.activateAccount.mock.calls[0]?.[1]).toBe('123');

        const detailActionWrongMethod = await handlers.GET(req, {
            params: Promise.resolve({ tango: ['123', 'activate-account'] }),
        });
        expect(detailActionWrongMethod.status).toBe(405);

        const collectionAction = await handlers.GET(req, {
            params: Promise.resolve({ tango: ['metrics', 'daily'] }),
        });
        expect(collectionAction.status).toBe(200);
        expect(viewset.metrics).toHaveBeenCalledTimes(1);

        const collectionActionWrongMethod = await handlers.POST(req, {
            params: Promise.resolve({ tango: ['metrics', 'daily'] }),
        });
        expect(collectionActionWrongMethod.status).toBe(405);

        const unknownAction = await handlers.POST(req, {
            params: Promise.resolve({ tango: ['123', 'unknown-action'] }),
        });
        expect(unknownAction.status).toBe(405);
    });

    it('uses detail-first resolution for single-segment GET paths', async () => {
        const adapter = new NextAdapter();
        const viewset = {
            list: vi.fn(async () => emptyResponse(200)),
            create: vi.fn(async () => emptyResponse(201)),
            retrieve: vi.fn(async (_ctx, id: string) => jsonResponse({ id }, 200)),
            update: vi.fn(async () => emptyResponse(200)),
            destroy: vi.fn(async () => emptyResponse(204)),
            metrics: vi.fn(async () => jsonResponse({ action: 'metrics' }, 200)),
            constructor: {
                getActions: () =>
                    [
                        {
                            name: 'metrics',
                            scope: 'collection',
                            methods: ['GET'],
                            path: 'metrics',
                        },
                    ] as const,
            },
        };
        const handlers = adapter.adaptViewSet(viewset);
        const req = { url: 'http://localhost/api/users' } as unknown as NextRequest;

        const response = await handlers.GET(req, {
            params: Promise.resolve({ tango: ['metrics'] }),
        });

        expect(response.status).toBe(200);
        expect(viewset.retrieve).toHaveBeenCalledTimes(1);
        expect(viewset.retrieve.mock.calls[0]?.[1]).toBe('metrics');
        expect(viewset.metrics).not.toHaveBeenCalled();
    });

    it('returns 404 when declared custom action handlers are missing', async () => {
        const adapter = new NextAdapter();
        const viewset = {
            list: vi.fn(async () => emptyResponse(200)),
            create: vi.fn(async () => emptyResponse(201)),
            retrieve: vi.fn(async () => emptyResponse(200)),
            update: vi.fn(async () => emptyResponse(200)),
            destroy: vi.fn(async () => emptyResponse(204)),
            constructor: {
                getActions: () =>
                    [
                        {
                            name: 'missingCollection',
                            scope: 'collection',
                            methods: ['DELETE'],
                            path: 'ops/purge',
                        },
                        {
                            name: 'missingDetail',
                            scope: 'detail',
                            methods: ['POST'],
                            path: 'activate',
                        },
                    ] as const,
            },
        };

        const handlers = adapter.adaptViewSet(viewset);
        const req = { url: 'http://localhost/api/users' } as unknown as NextRequest;

        const missingCollection = await handlers.DELETE(req, {
            params: Promise.resolve({ tango: ['ops', 'purge'] }),
        });
        expect(missingCollection.status).toBe(404);

        const missingDetail = await handlers.POST(req, {
            params: Promise.resolve({ tango: ['123', 'activate'] }),
        });
        expect(missingDetail.status).toBe(404);
    });

    it('routes PUT and DELETE custom actions to the matching handlers', async () => {
        const adapter = new NextAdapter();
        const viewset = {
            list: vi.fn(async () => emptyResponse(200)),
            create: vi.fn(async () => emptyResponse(201)),
            retrieve: vi.fn(async () => emptyResponse(200)),
            update: vi.fn(async () => emptyResponse(200)),
            destroy: vi.fn(async () => emptyResponse(204)),
            freeze: vi.fn(async () => jsonResponse({ ok: true }, 200)),
            purge: vi.fn(async () => jsonResponse({ ok: true }, 200)),
            archive: vi.fn(async () => jsonResponse({ ok: true }, 200)),
            constructor: {
                getActions: () =>
                    [
                        {
                            name: 'freeze',
                            scope: 'detail',
                            methods: ['PUT'],
                            path: 'freeze',
                        },
                        {
                            name: 'purge',
                            scope: 'collection',
                            methods: ['DELETE'],
                            path: 'ops/purge',
                        },
                        {
                            name: 'archive',
                            scope: 'detail',
                            methods: ['DELETE'],
                            path: 'archive',
                        },
                        {
                            name: 'activate',
                            scope: 'detail',
                            methods: ['POST'],
                            path: 'activate',
                        },
                    ] as const,
            },
        };
        const handlers = adapter.adaptViewSet(viewset);
        const req = { url: 'http://localhost/api/users' } as unknown as NextRequest;

        const putDetailAction = await handlers.PUT(req, {
            params: Promise.resolve({ tango: ['123', 'freeze'] }),
        });
        expect(putDetailAction.status).toBe(200);

        const putWrongMethod = await handlers.PUT(req, {
            params: Promise.resolve({ tango: ['123', 'activate'] }),
        });
        expect(putWrongMethod.status).toBe(405);

        const deleteCollectionAction = await handlers.DELETE(req, {
            params: Promise.resolve({ tango: ['ops', 'purge'] }),
        });
        expect(deleteCollectionAction.status).toBe(200);

        const deleteDetailAction = await handlers.DELETE(req, {
            params: Promise.resolve({ tango: ['123', 'archive'] }),
        });
        expect(deleteDetailAction.status).toBe(200);

        const deleteWrongMethod = await handlers.DELETE(req, {
            params: Promise.resolve({ tango: ['123', 'activate'] }),
        });
        expect(deleteWrongMethod.status).toBe(405);
    });

    it('routes PATCH detail actions and PUT collection actions', async () => {
        const adapter = new NextAdapter();
        const viewset = {
            list: vi.fn(async () => emptyResponse(200)),
            create: vi.fn(async () => emptyResponse(201)),
            retrieve: vi.fn(async () => emptyResponse(200)),
            update: vi.fn(async () => emptyResponse(200)),
            destroy: vi.fn(async () => emptyResponse(204)),
            patchDetailAction: vi.fn(async () => jsonResponse({ ok: true }, 200)),
            patchCollectionAction: vi.fn(async () => jsonResponse({ ok: true }, 200)),
            putCollectionAction: vi.fn(async () => jsonResponse({ ok: true }, 200)),
            constructor: {
                getActions: () =>
                    [
                        {
                            name: 'patchDetailAction',
                            scope: 'detail',
                            methods: ['PATCH'],
                            path: 'patch-detail',
                        },
                        {
                            name: 'patchCollectionAction',
                            scope: 'collection',
                            methods: ['PATCH'],
                            path: 'ops/patch-all',
                        },
                        {
                            name: 'putCollectionAction',
                            scope: 'collection',
                            methods: ['PUT'],
                            path: 'ops/put-all',
                        },
                        {
                            name: 'patchDisallowed',
                            scope: 'detail',
                            methods: ['POST'],
                            path: 'disallowed',
                        },
                    ] as const,
            },
        };
        const handlers = adapter.adaptViewSet(viewset);
        const req = { url: 'http://localhost/api/users' } as unknown as NextRequest;

        const patchDetail = await handlers.PATCH(req, {
            params: Promise.resolve({ tango: ['123', 'patch-detail'] }),
        });
        expect(patchDetail.status).toBe(200);

        const patchCollection = await handlers.PATCH(req, {
            params: Promise.resolve({ tango: ['ops', 'patch-all'] }),
        });
        expect(patchCollection.status).toBe(200);

        const patchMethodMismatch = await handlers.PATCH(req, {
            params: Promise.resolve({ tango: ['123', 'disallowed'] }),
        });
        expect(patchMethodMismatch.status).toBe(405);

        const putCollection = await handlers.PUT(req, {
            params: Promise.resolve({ tango: ['ops', 'put-all'] }),
        });
        expect(putCollection.status).toBe(200);
    });

    it('returns detail actions, missing-action 404s, and collection action results', async () => {
        const adapter = new NextAdapter();
        const viewset = {
            list: vi.fn(async () => emptyResponse(200)),
            create: vi.fn(async () => emptyResponse(201)),
            retrieve: vi.fn(async () => emptyResponse(200)),
            update: vi.fn(async () => emptyResponse(200)),
            destroy: vi.fn(async () => emptyResponse(204)),
            detailReadAction: vi.fn(async () => jsonResponse({ ok: true }, 200)),
            bulkCreateAction: vi.fn(async () => jsonResponse({ ok: true }, 200)),
            constructor: {
                getActions: () =>
                    [
                        {
                            name: 'detailReadAction',
                            scope: 'detail',
                            methods: ['GET'],
                            path: 'inspect',
                        },
                        {
                            name: 'bulkCreateAction',
                            scope: 'collection',
                            methods: ['POST'],
                            path: 'bulk/import',
                        },
                    ] as const,
            },
        };
        const handlers = adapter.adaptViewSet(viewset);
        const req = { url: 'http://localhost/api/users' } as unknown as NextRequest;

        const getDetailAction = await handlers.GET(req, {
            params: Promise.resolve({ tango: ['99', 'inspect'] }),
        });
        expect(getDetailAction.status).toBe(200);

        const getUnknownAction = await handlers.GET(req, {
            params: Promise.resolve({ tango: ['99', 'missing'] }),
        });
        expect(getUnknownAction.status).toBe(404);

        const postCollectionAction = await handlers.POST(req, {
            params: Promise.resolve({ tango: ['bulk', 'import'] }),
        });
        expect(postCollectionAction.status).toBe(200);
    });
});

describe('APIView adapter helpers', () => {
    it('adaptAPIView dispatches methods to APIView', async () => {
        const apiView = {
            dispatch: vi.fn(async () => jsonResponse({ ok: true }, 200)),
        };

        const adapter = new NextAdapter();
        const handlers = adapter.adaptAPIView(apiView);
        const req = { url: 'http://localhost/api/ping' } as unknown as NextRequest;

        const getResponse = await handlers.GET(req, { params: Promise.resolve({}) });
        expect(getResponse.status).toBe(200);

        const postResponse = await handlers.POST(req, { params: Promise.resolve({}) });
        expect(postResponse.status).toBe(200);

        const patchResponse = await handlers.PATCH(req, { params: Promise.resolve({}) });
        const putResponse = await handlers.PUT(req, { params: Promise.resolve({}) });
        const deleteResponse = await handlers.DELETE(req, { params: Promise.resolve({}) });
        expect(patchResponse.status).toBe(200);
        expect(putResponse.status).toBe(200);
        expect(deleteResponse.status).toBe(200);
    });

    it('adaptGenericAPIView splits collection and detail routes', async () => {
        const apiView = {
            dispatch: vi.fn(async () => jsonResponse({ ok: true }, 200)),
        };

        const adapter = new NextAdapter();
        const handlers = adapter.adaptGenericAPIView(apiView, { paramKey: 'tango' });
        const req = { url: 'http://localhost/api/posts' } as unknown as NextRequest;

        const collectionGet = await handlers.GET(req, { params: Promise.resolve({}) });
        expect(collectionGet.status).toBe(200);

        const detailPatch = await handlers.PATCH(req, {
            params: Promise.resolve({ tango: ['1'] }),
        });
        expect(detailPatch.status).toBe(200);

        const collectionDelete = await handlers.DELETE(req, { params: Promise.resolve({}) });
        expect(collectionDelete.status).toBe(405);

        const collectionPost = await handlers.POST(req, { params: Promise.resolve({}) });
        expect(collectionPost.status).toBe(200);

        const patchWithoutDetail = await handlers.PATCH(req, { params: Promise.resolve({}) });
        const putWithoutDetail = await handlers.PUT(req, { params: Promise.resolve({}) });
        expect(patchWithoutDetail.status).toBe(405);
        expect(putWithoutDetail.status).toBe(405);

        const detailPut = await handlers.PUT(req, {
            params: Promise.resolve({ tango: ['1'] }),
        });
        expect(detailPut.status).toBe(200);

        const detailDelete = await handlers.DELETE(req, {
            params: Promise.resolve({ tango: ['1'] }),
        });
        expect(detailDelete.status).toBe(200);

        const postDetailShould405 = await handlers.POST(req, {
            params: Promise.resolve({ tango: ['1'] }),
        });
        expect(postDetailShould405.status).toBe(405);

        const directIdGet = await handlers.GET(req, {
            params: Promise.resolve({ id: '7' }),
        });
        expect(directIdGet.status).toBe(200);
    });

    it('adaptGenericAPIView uses default paramKey when omitted', async () => {
        const apiView = {
            dispatch: vi.fn(async () => jsonResponse({ ok: true }, 200)),
        };
        const adapter = new NextAdapter();
        const handlers = adapter.adaptGenericAPIView(apiView);
        const req = { url: 'http://localhost/api/posts' } as unknown as NextRequest;

        const detailGet = await handlers.GET(req, { params: Promise.resolve({ tango: ['5'] }) });
        expect(detailGet.status).toBe(200);
    });

    it('adapts generic API views from lazy factories with one-time initialization', async () => {
        const adapter = new NextAdapter();
        const apiView = {
            dispatch: vi.fn(async () => jsonResponse({ ok: true }, 200)),
        };
        const factory = vi.fn(async () => apiView);
        const handlers = adapter.adaptGenericAPIViewFactory(factory, { paramKey: 'tango' });
        const req = { url: 'http://localhost/api/posts' } as unknown as NextRequest;

        const first = await handlers.GET(req, { params: Promise.resolve({}) });
        const second = await handlers.GET(req, { params: Promise.resolve({}) });
        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(factory).toHaveBeenCalledTimes(1);
        expect(apiView.dispatch).toHaveBeenCalledTimes(2);
    });

    it('retries generic API view lazy initialization after factory failure', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const adapter = new NextAdapter();
        const apiView = {
            dispatch: vi.fn(async () => jsonResponse({ ok: true }, 200)),
        };
        const factory = vi
            .fn<() => Promise<typeof apiView>>()
            .mockRejectedValueOnce(new Error('api-view-init-failed'))
            .mockResolvedValueOnce(apiView);

        const handlers = adapter.adaptGenericAPIViewFactory(factory, { paramKey: 'tango' });
        const req = { url: 'http://localhost/api/posts' } as unknown as NextRequest;

        const first = await handlers.GET(req, { params: Promise.resolve({}) });
        expect(first.status).toBe(500);

        const second = await handlers.GET(req, { params: Promise.resolve({}) });
        expect(second.status).toBe(200);
        expect(factory).toHaveBeenCalledTimes(2);
        consoleSpy.mockRestore();
    });
});
