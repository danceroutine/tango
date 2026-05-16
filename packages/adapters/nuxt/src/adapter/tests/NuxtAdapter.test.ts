import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { H3Event } from 'h3';
import { TangoQueryParams, TangoRequest, TangoResponse } from '@danceroutine/tango-core';
import { isFrameworkAdapter } from '@danceroutine/tango-adapters-core';
import { BoundFrameworkAdapterRequestExecutor } from '@danceroutine/tango-adapters-core/adapter';
import { NuxtAdapter, toNuxtQueryParams } from '..';

function jsonResponse(data: unknown, status: number = 200): TangoResponse {
    return TangoResponse.json(data as Parameters<typeof TangoResponse.json>[0], { status });
}

function emptyResponse(status: number): TangoResponse {
    return new TangoResponse({ status });
}

function createEvent(
    options: {
        method?: string;
        eventMethod?: string | null;
        requestMethod?: string | null;
        url?: string;
        params?: Record<string, string> | null;
        headers?: Record<string, string>;
        body?: string | Uint8Array;
    } = {}
): H3Event {
    const url = new URL(options.url ?? 'http://localhost/api/posts');
    const rawBody =
        typeof options.body === 'string' ? options.body : options.body ? Buffer.from(options.body) : undefined;
    const requestMethod =
        options.requestMethod === null ? undefined : (options.requestMethod ?? options.method ?? 'GET');
    const eventMethod = options.eventMethod === null ? undefined : (options.eventMethod ?? requestMethod);

    const req = {
        method: requestMethod,
        headers: Object.assign({ host: url.host }, options.headers),
        on: vi.fn(),
        off: vi.fn(),
        once: vi.fn(),
        emit: vi.fn(),
        readable: true,
        destroyed: false,
        push: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        pipe: vi.fn(),
        unpipe: vi.fn(),
        read: vi.fn(),
        removeListener: vi.fn(),
        prependListener: vi.fn(),
        prependOnceListener: vi.fn(),
        setEncoding: vi.fn(),
        rawBody,
        __unenv__: {
            body: rawBody,
        },
    };

    const res = {
        statusCode: 200,
        statusMessage: 'OK',
        setHeader: vi.fn(),
        getHeader: vi.fn(),
        removeHeader: vi.fn(),
        end: vi.fn(),
    };

    return {
        method: eventMethod,
        path: `${url.pathname}${url.search}`,
        node: { req, res },
        context: options.params === null ? {} : { params: options.params ?? {} },
    } as unknown as H3Event;
}

type BoundRequestExecutorRunner = {
    runMaterializedResponse: (
        method: string | undefined,
        transaction: 'writes' | undefined,
    ) => Promise<unknown>;
};

describe(NuxtAdapter, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('satisfies the shared framework adapter typeguard', () => {
        expect(isFrameworkAdapter(new NuxtAdapter())).toBe(true);
    });

    it('can be created without configuration', () => {
        const adapter = new NuxtAdapter();
        expect(adapter).toBeInstanceOf(NuxtAdapter);
    });

    it('normalizes h3-style search params into Tango query params', () => {
        const adapter = new NuxtAdapter();
        const params = adapter.toQueryParams(new URLSearchParams('search=%20tango%20&tag=orm&tag=http'));

        expect(TangoQueryParams.isTangoQueryParams(params)).toBe(true);
        expect(params.getSearch()).toBe('tango');
        expect(params.getAll('tag')).toEqual(['orm', 'http']);
    });

    it('normalizes record-based query params into Tango query params', () => {
        const adapter = new NuxtAdapter();
        const params = adapter.toQueryParams({ search: 'nuxt', tag: ['orm', 'resources'] });

        expect(params.getSearch()).toBe('nuxt');
        expect(params.getAll('tag')).toEqual(['orm', 'resources']);
    });

    it('normalizes route-query style records with nullable values into Tango query params', () => {
        const params = toNuxtQueryParams({
            search: 'nuxt',
            tag: ['orm', 'resources'],
            ignored: [null],
            empty: null,
            missing: undefined,
        });

        expect(params.getSearch()).toBe('nuxt');
        expect(params.getAll('tag')).toEqual(['orm', 'resources']);
        expect(params.getAll('ignored')).toEqual([]);
        expect(params.get('empty')).toBeUndefined();
        expect(params.get('missing')).toBeUndefined();
    });

    it('treats undefined methods as unsupported during normalization', () => {
        const adapter = new NuxtAdapter();

        expect(
            (adapter as unknown as { resolveMethod(method: string | undefined): string | null }).resolveMethod(
                undefined
            )
        ).toBeNull();
    });

    it('adapts handlers and passes route id params when expected', async () => {
        const adapter = new NuxtAdapter();
        const view = vi.fn(async (_ctx: unknown, id: unknown) => jsonResponse({ id: String(id) }, 200));
        const handler = adapter.adapt(view);

        const response = await handler(createEvent({ url: 'http://localhost/users/42', params: { id: '42' } }));

        expect(view).toHaveBeenCalledTimes(1);
        expect(view.mock.calls[0]?.[1]).toBe('42');
        expect(response.status).toBe(200);
    });

    it('injects user into the request context', async () => {
        const adapter = new NuxtAdapter();
        const view = vi.fn(async (ctx) => jsonResponse({ hasUser: !!ctx.user }, 200));
        const handler = adapter.adapt(view, {
            getUser: async () => ({ id: 7 }),
        });

        const response = await handler(createEvent());
        const body = await response.json();

        expect(body).toEqual({ hasUser: true });
        expect(view).toHaveBeenCalledTimes(1);
    });

    it('normalizes the request URL and body into a Tango request context', async () => {
        const adapter = new NuxtAdapter();
        const view = vi.fn(async (ctx) => {
            expect(TangoRequest.isTangoRequest(ctx.request)).toBe(true);
            return jsonResponse({
                url: ctx.request.url,
                search: ctx.request.queryParams.getSearch(),
            });
        });
        const handler = adapter.adapt(view);

        const response = await handler(
            createEvent({
                method: 'POST',
                url: 'http://localhost/users?search=tango',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ ok: true }),
            })
        );
        const body = await response.json();

        expect(body).toEqual({
            url: 'http://localhost/users?search=tango',
            search: 'tango',
        });
    });

    it('falls back through request method sources when event.method is absent', async () => {
        const adapter = new NuxtAdapter();
        const handler = adapter.adapt(async (ctx) => jsonResponse({ method: ctx.request.method }));

        const requestMethodResponse = await handler(
            createEvent({
                eventMethod: null,
                requestMethod: 'GET',
                url: 'http://localhost/users',
            })
        );
        expect(await requestMethodResponse.json()).toEqual({ method: 'GET' });

        const defaultMethodResponse = await handler(
            createEvent({
                eventMethod: null,
                requestMethod: null,
                url: 'http://localhost/users',
            })
        );
        expect(await defaultMethodResponse.json()).toEqual({ method: 'GET' });
    });

    it('normalizes binary request bodies into web-compatible payloads', async () => {
        const adapter = new NuxtAdapter();
        const handler = adapter.adapt(async (ctx) => jsonResponse({ body: await ctx.request.text() }));

        const response = await handler(
            createEvent({
                method: 'POST',
                url: 'http://localhost/users',
                body: new Uint8Array([110, 117, 120, 116]),
            })
        );

        expect(await response.json()).toEqual({ body: 'nuxt' });
    });

    it('returns 500 response on handler error', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const adapter = new NuxtAdapter();
        const handler = adapter.adapt(async () => {
            throw new Error('boom');
        });

        const response = await handler(createEvent());
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
        const adapter = new NuxtAdapter();
        const handler = adapter.adapt(async () => jsonResponse({ ok: true }, 201), { transaction: 'writes' });

        const response = await handler(createEvent({ method: 'POST' }));

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
        const adapter = new NuxtAdapter();
        const handler = adapter.adapt(async () => jsonResponse({ ok: true }, 200), { transaction: 'writes' });

        const response = await handler(createEvent({ method: 'GET' }));

        expect(response.status).toBe(200);
        expect(runMaterializedResponseSpy).toHaveBeenCalledWith('GET', 'writes');
        runMaterializedResponseSpy.mockRestore();
    });

    it('adapts full CRUD handlers for catch-all routes', async () => {
        const adapter = new NuxtAdapter();
        const viewset = {
            list: vi.fn(async () => jsonResponse({ action: 'list' }, 200)),
            create: vi.fn(async () => jsonResponse({ action: 'create' }, 201)),
            retrieve: vi.fn(async (_ctx, id: string) => jsonResponse({ action: 'retrieve', id }, 200)),
            update: vi.fn(async (_ctx, id: string) => jsonResponse({ action: 'update', id }, 200)),
            destroy: vi.fn(async () => emptyResponse(204)),
        };
        const handler = adapter.adaptViewSet(viewset);

        const listResponse = await handler(createEvent({ method: 'GET' }));
        expect(listResponse.status).toBe(200);
        expect(viewset.list).toHaveBeenCalledTimes(1);

        const retrieveResponse = await handler(createEvent({ method: 'GET', params: { tango: '123' } }));
        expect(retrieveResponse.status).toBe(200);
        expect(viewset.retrieve).toHaveBeenCalledTimes(1);
        expect(viewset.retrieve.mock.calls[0]?.[1]).toBe('123');

        const createResponse = await handler(createEvent({ method: 'POST' }));
        expect(createResponse.status).toBe(201);
        expect(viewset.create).toHaveBeenCalledTimes(1);

        const createWithId = await handler(createEvent({ method: 'POST', params: { tango: '999' } }));
        expect(createWithId.status).toBe(405);

        const patchResponse = await handler(createEvent({ method: 'PATCH', params: { tango: '456' } }));
        expect(patchResponse.status).toBe(200);
        expect(viewset.update).toHaveBeenCalledTimes(1);
        expect(viewset.update.mock.calls[0]?.[1]).toBe('456');

        const putResponse = await handler(createEvent({ method: 'PUT', params: { tango: '789' } }));
        expect(putResponse.status).toBe(200);
        expect(viewset.update).toHaveBeenCalledTimes(2);
        expect(viewset.update.mock.calls[1]?.[1]).toBe('789');

        const putWithoutId = await handler(createEvent({ method: 'PUT' }));
        expect(putWithoutId.status).toBe(405);

        const putWithNestedPath = await handler(createEvent({ method: 'PUT', params: { tango: '789/typo' } }));
        expect(putWithNestedPath.status).toBe(404);
        expect(viewset.update).toHaveBeenCalledTimes(2);

        const retrieveByDirectId = await handler(createEvent({ method: 'GET', params: { id: '321' } }));
        expect(retrieveByDirectId.status).toBe(200);
        expect(viewset.retrieve).toHaveBeenCalledTimes(2);
        expect(viewset.retrieve.mock.calls[1]?.[1]).toBe('321');

        const deleteWithoutId = await handler(createEvent({ method: 'DELETE' }));
        expect(deleteWithoutId.status).toBe(405);

        const deleteWithId = await handler(createEvent({ method: 'DELETE', params: { tango: '654' } }));
        expect(deleteWithId.status).toBe(204);
        expect(viewset.destroy).toHaveBeenCalledTimes(1);

        const deleteWithNestedPath = await handler(createEvent({ method: 'DELETE', params: { tango: '654/typo' } }));
        expect(deleteWithNestedPath.status).toBe(404);
        expect(viewset.destroy).toHaveBeenCalledTimes(1);

        const patchWithoutId = await handler(createEvent({ method: 'PATCH' }));
        expect(patchWithoutId.status).toBe(405);

        const patchWithNestedPath = await handler(createEvent({ method: 'PATCH', params: { tango: '456/typo' } }));
        expect(patchWithNestedPath.status).toBe(404);
        expect(viewset.update).toHaveBeenCalledTimes(2);

        const retrieveWithNestedAction = await handler(
            createEvent({ method: 'GET', params: { tango: '123/publish' } })
        );
        expect(retrieveWithNestedAction.status).toBe(404);

        const optionsResponse = await handler(createEvent({ method: 'OPTIONS' }));
        expect(optionsResponse.status).toBe(405);
    });

    it('routes custom collection and detail actions', async () => {
        class ActionViewSet {
            list = vi.fn(async () => jsonResponse({ action: 'list' }));
            create = vi.fn(async () => jsonResponse({ action: 'create' }, 201));
            retrieve = vi.fn(async (_ctx, id: string) => jsonResponse({ action: 'retrieve', id }));
            update = vi.fn(async (_ctx, id: string) => jsonResponse({ action: 'update', id }));
            destroy = vi.fn(async () => emptyResponse(204));
            publish = vi.fn(async (_ctx, id: string) => jsonResponse({ action: 'publish', id }));
            stats = vi.fn(async () => jsonResponse({ action: 'stats' }));
            reindex = vi.fn(async () => jsonResponse({ action: 'reindex' }));

            static getActions(): readonly {
                name: string;
                scope: 'detail' | 'collection';
                methods: readonly ('GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE')[];
                path: string;
            }[] {
                return [
                    { name: 'publish', scope: 'detail', methods: ['POST'], path: 'publish' },
                    { name: 'stats', scope: 'collection', methods: ['GET'], path: 'stats' },
                    { name: 'reindex', scope: 'collection', methods: ['POST'], path: 'reindex' },
                ];
            }
        }

        const viewset = new ActionViewSet();
        const adapter = new NuxtAdapter();
        const handler = adapter.adaptViewSet(viewset);

        const detailAction = await handler(createEvent({ method: 'POST', params: { tango: '42/publish' } }));
        expect(detailAction.status).toBe(200);
        expect(viewset.publish).toHaveBeenCalledTimes(1);
        expect(viewset.publish.mock.calls[0]?.[1]).toBe('42');

        const collectionAction = await handler(createEvent({ method: 'POST', params: { tango: 'reindex' } }));
        expect(collectionAction.status).toBe(200);
        expect(viewset.reindex).toHaveBeenCalledTimes(1);

        const getCollectionAction = await handler(createEvent({ method: 'GET', params: { tango: 'stats' } }));
        expect(getCollectionAction.status).toBe(200);
        expect(await getCollectionAction.json()).toEqual({ action: 'stats' });
        expect(viewset.stats).toHaveBeenCalledTimes(1);
        expect(viewset.retrieve).not.toHaveBeenCalled();

        const collectionMethodNotAllowed = await handler(
            createEvent({ method: 'DELETE', params: { tango: 'reindex' } })
        );
        expect(collectionMethodNotAllowed.status).toBe(405);

        const detailMethodNotAllowed = await handler(createEvent({ method: 'GET', params: { tango: '42/publish' } }));
        expect(detailMethodNotAllowed.status).toBe(405);
    });

    it('returns 404 when declared custom action methods are missing on the viewset instance', async () => {
        class MissingActionViewSet {
            list = vi.fn(async () => jsonResponse({ action: 'list' }));
            create = vi.fn(async () => jsonResponse({ action: 'create' }, 201));
            retrieve = vi.fn(async (_ctx, id: string) => jsonResponse({ action: 'retrieve', id }));
            update = vi.fn(async (_ctx, id: string) => jsonResponse({ action: 'update', id }));
            destroy = vi.fn(async () => emptyResponse(204));

            static getActions(): readonly {
                name: string;
                scope: 'detail' | 'collection';
                methods: readonly ('GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE')[];
                path: string;
            }[] {
                return [
                    { name: 'publish', scope: 'detail', methods: ['POST'], path: 'publish' },
                    { name: 'reindex', scope: 'collection', methods: ['POST'], path: 'reindex' },
                ];
            }
        }

        const adapter = new NuxtAdapter();
        const handler = adapter.adaptViewSet(new MissingActionViewSet());

        const missingDetailAction = await handler(createEvent({ method: 'POST', params: { tango: '42/publish' } }));
        expect(missingDetailAction.status).toBe(404);

        const missingCollectionAction = await handler(createEvent({ method: 'POST', params: { tango: 'reindex' } }));
        expect(missingCollectionAction.status).toBe(404);
    });

    it('adapts viewsets from lazy factories with one-time initialization', async () => {
        const adapter = new NuxtAdapter();
        const viewset = {
            list: vi.fn(async () => jsonResponse({ action: 'list' }, 200)),
            create: vi.fn(async () => jsonResponse({ action: 'create' }, 201)),
            retrieve: vi.fn(async (_ctx, id: string) => jsonResponse({ id }, 200)),
            update: vi.fn(async () => emptyResponse(200)),
            destroy: vi.fn(async () => emptyResponse(204)),
        };
        const factory = vi.fn(async () => viewset);

        const handler = adapter.adaptViewSetFactory(factory, { paramKey: 'tango' });

        const listResponse = await handler(createEvent({ method: 'GET' }));
        expect(listResponse.status).toBe(200);
        expect(viewset.list).toHaveBeenCalledTimes(1);
        expect(factory).toHaveBeenCalledTimes(1);

        const createResponse = await handler(createEvent({ method: 'POST' }));
        expect(createResponse.status).toBe(201);
        expect(viewset.create).toHaveBeenCalledTimes(1);
        expect(factory).toHaveBeenCalledTimes(1);
    });

    it('retries lazy initialization after factory failure', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const adapter = new NuxtAdapter();
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

        const handler = adapter.adaptViewSetFactory(factory, { paramKey: 'tango' });

        const first = await handler(createEvent({ method: 'GET' }));
        const firstBody = await first.json();
        expect(first.status).toBe(500);
        expect(firstBody).toEqual({ error: 'db-not-ready', details: null });
        expect(factory).toHaveBeenCalledTimes(1);

        const second = await handler(createEvent({ method: 'GET' }));
        expect(second.status).toBe(200);
        expect(viewset.list).toHaveBeenCalledTimes(1);
        expect(factory).toHaveBeenCalledTimes(2);
        consoleSpy.mockRestore();
    });

    it('dispatches APIViews across HTTP methods', async () => {
        const adapter = new NuxtAdapter();
        const apiView = {
            dispatch: vi.fn(async (ctx) => jsonResponse({ method: ctx.request.method }, 200)),
        };
        const handler = adapter.adaptAPIView(apiView);

        const getResponse = await handler(createEvent({ method: 'GET' }));
        expect(getResponse.status).toBe(200);

        const postResponse = await handler(createEvent({ method: 'POST' }));
        expect(postResponse.status).toBe(200);

        expect(apiView.dispatch).toHaveBeenCalledTimes(2);
    });

    it('supports GenericAPIView collection and detail routing', async () => {
        const adapter = new NuxtAdapter();
        const apiView = {
            dispatch: vi.fn(async (ctx) => jsonResponse({ id: ctx.params.id ?? null }, 200)),
        };
        const handler = adapter.adaptGenericAPIView(apiView);

        const listResponse = await handler(createEvent({ method: 'GET' }));
        expect(await listResponse.json()).toEqual({ id: null });

        const detailResponse = await handler(createEvent({ method: 'GET', params: { tango: '77' } }));
        expect(await detailResponse.json()).toEqual({ id: '77' });

        const directIdResponse = await handler(createEvent({ method: 'GET', params: { id: '88' } }));
        expect(await directIdResponse.json()).toEqual({ id: '88' });

        const createOnDetail = await handler(createEvent({ method: 'POST', params: { tango: '77' } }));
        expect(createOnDetail.status).toBe(405);

        const createOnCollection = await handler(createEvent({ method: 'POST' }));
        expect(await createOnCollection.json()).toEqual({ id: null });

        const patchOnDetail = await handler(createEvent({ method: 'PATCH', params: { tango: '77' } }));
        expect(await patchOnDetail.json()).toEqual({ id: '77' });

        const patchWithoutDetail = await handler(createEvent({ method: 'PATCH' }));
        expect(patchWithoutDetail.status).toBe(405);

        const optionsResponse = await handler(createEvent({ method: 'OPTIONS' }));
        expect(optionsResponse.status).toBe(405);
    });

    it('adapts GenericAPIView factories with one-time initialization', async () => {
        const adapter = new NuxtAdapter();
        const apiView = {
            dispatch: vi.fn(async () => jsonResponse({ ok: true }, 200)),
        };
        const factory = vi.fn(async () => apiView);
        const handler = adapter.adaptGenericAPIViewFactory(factory);

        const first = await handler(createEvent({ method: 'GET' }));
        const second = await handler(createEvent({ method: 'GET', params: { tango: '12' } }));

        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(factory).toHaveBeenCalledTimes(1);
        expect(apiView.dispatch).toHaveBeenCalledTimes(2);
    });

    it('handles events without route params', async () => {
        const adapter = new NuxtAdapter();
        const view = vi.fn(async (ctx) => jsonResponse({ params: ctx.params }, 200));
        const handler = adapter.adapt(view);

        const response = await handler(createEvent({ params: null }));

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ params: {} });
    });
});
