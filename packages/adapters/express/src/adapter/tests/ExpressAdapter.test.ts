import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { TangoQueryParams, TangoResponse } from '@danceroutine/tango-core';
import { isFrameworkAdapter } from '@danceroutine/tango-adapters-core';
import { aDBClient, aTangoConfig, anExpressRequest, anExpressResponse } from '@danceroutine/tango-testing';
import { getTangoRuntime, initializeTangoRuntime, resetTangoRuntime } from '@danceroutine/tango-orm/runtime';
import { atomic } from '@danceroutine/tango-orm/transaction';
import { ExpressAdapter } from '..';

type RouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

function jsonResponse(data: unknown, status: number = 200): TangoResponse {
    return TangoResponse.json(data as Parameters<typeof TangoResponse.json>[0], { status });
}

function textResponse(text: string, status: number = 200, headers?: HeadersInit): TangoResponse {
    return TangoResponse.text(text, { status, headers });
}

function bodyResponse(body: BodyInit | null, status: number = 200, headers?: HeadersInit): TangoResponse {
    return new TangoResponse({ body, status, headers });
}

function emptyResponse(status: number): TangoResponse {
    return new TangoResponse({ status });
}

function getRegisteredHandler(methodMock: ReturnType<typeof vi.fn>, index: number): RouteHandler {
    const call = methodMock.mock.calls[index];
    if (!call) {
        throw new Error(`Expected route registration at index ${String(index)}`);
    }
    return call[1] as RouteHandler;
}

function findRegisteredHandler(methodMock: ReturnType<typeof vi.fn>, path: string): RouteHandler {
    const call = methodMock.mock.calls.find((candidate) => candidate[0] === path);
    if (!call) {
        throw new Error(`Expected route registration for path '${path}'`);
    }
    return call[1] as RouteHandler;
}

function setupTransactionalRuntime() {
    const runtime = initializeTangoRuntime(() => aTangoConfig());
    const client = aDBClient();
    const release = vi.fn(async () => {});

    vi.spyOn(runtime, 'leaseTransactionClient').mockResolvedValue({ client, release });
    const runtimeQuery = vi.spyOn(runtime, 'query').mockResolvedValue({ rows: [] });

    return {
        runtime,
        client,
        release,
        runtimeQuery,
    };
}

describe(ExpressAdapter, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(async () => {
        await resetTangoRuntime();
    });

    it('satisfies the shared framework adapter typeguard', () => {
        expect(isFrameworkAdapter(new ExpressAdapter())).toBe(true);
    });

    it('adapts a handler and forwards status/headers/body', async () => {
        const adapter = new ExpressAdapter();
        const routeHandler = adapter.adapt(async () => {
            return textResponse('ok', 201, {
                'content-type': 'text/plain',
                'x-test': 'yes',
            });
        });

        const req = anExpressRequest({
            originalUrl: '/users',
            url: '/users',
        });
        const res = anExpressResponse();
        const next = vi.fn() as unknown as NextFunction;

        await routeHandler(req, res, next);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.setHeader).toHaveBeenCalledWith('content-type', 'text/plain');
        expect(res.setHeader).toHaveBeenCalledWith('x-test', 'yes');
        expect(res.send).toHaveBeenCalledWith('ok');
        expect(res.end).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    it('normalizes Express requests into Tango query params', () => {
        const adapter = new ExpressAdapter();
        const req = anExpressRequest({
            method: 'GET',
            originalUrl: '/users?search=%20tango%20&tag=orm&tag=http',
            url: '/users?search=%20tango%20&tag=orm&tag=http',
        });

        const params = adapter.toQueryParams(req);

        expect(TangoQueryParams.isTangoQueryParams(params)).toBe(true);
        expect(params.getSearch()).toBe('tango');
        expect(params.getAll('tag')).toEqual(['orm', 'http']);
    });

    it('passes id param as second argument when handler expects it', async () => {
        const adapter = new ExpressAdapter();
        const view = vi.fn(async (_ctx: unknown, id: unknown) => jsonResponse({ id: String(id) }, 200));
        const routeHandler = adapter.adapt(view);

        const req = anExpressRequest({
            method: 'GET',
            params: { id: '42' },
            originalUrl: '/users/42',
            url: '/users/42',
        });
        const res = anExpressResponse();
        const next = vi.fn() as unknown as NextFunction;

        await routeHandler(req, res, next);

        expect(view).toHaveBeenCalledTimes(1);
        const firstCall = view.mock.calls[0];
        if (!firstCall) {
            throw new Error('Expected view to be called');
        }
        expect(firstCall[1]).toBe('42');
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('handles array-valued id param by taking the first element', async () => {
        const adapter = new ExpressAdapter();
        const view = vi.fn(async (_ctx: unknown, id: unknown) => jsonResponse({ id: String(id) }, 200));
        const routeHandler = adapter.adapt(view);

        const req = anExpressRequest({
            method: 'GET',
            params: { id: ['42', '99'] as unknown as string },
            originalUrl: '/users/42',
            url: '/users/42',
        });
        const res = anExpressResponse();
        const next = vi.fn() as unknown as NextFunction;

        await routeHandler(req, res, next);

        const firstCall = view.mock.calls[0];
        if (!firstCall) {
            throw new Error('Expected view to be called');
        }
        expect(firstCall[1]).toBe('42');
    });

    it('injects user from getUser option', async () => {
        const adapter = new ExpressAdapter();
        const view = vi.fn(async (ctx) => {
            return jsonResponse({ userId: (ctx.user as { id: number } | null)?.id ?? null }, 200);
        });
        const routeHandler = adapter.adapt(view, {
            getUser: async () => ({ id: 123 }),
        });

        const req = anExpressRequest({ method: 'GET' });
        const res = anExpressResponse();
        const next = vi.fn() as unknown as NextFunction;

        await routeHandler(req, res, next);

        expect(view).toHaveBeenCalledTimes(1);
        const firstCall = view.mock.calls[0];
        if (!firstCall) {
            throw new Error('Expected view to be called');
        }
        expect((firstCall[0] as { user: { id: number } }).user.id).toBe(123);
    });

    it('ends response when handler returns empty body', async () => {
        const adapter = new ExpressAdapter();
        const routeHandler = adapter.adapt(async () => emptyResponse(204));

        const req = anExpressRequest({ method: 'DELETE' });
        const res = anExpressResponse();
        const next = vi.fn() as unknown as NextFunction;

        await routeHandler(req, res, next);

        expect(res.status).toHaveBeenCalledWith(204);
        expect(res.end).toHaveBeenCalled();
        expect(res.send).not.toHaveBeenCalled();
    });

    it('passes handler failures to the next middleware', async () => {
        const adapter = new ExpressAdapter();
        const expected = new Error('boom');
        const routeHandler = adapter.adapt(async () => {
            throw expected;
        });

        const req = anExpressRequest({ method: 'GET' });
        const res = anExpressResponse();
        const next = vi.fn() as unknown as NextFunction;

        await routeHandler(req, res, next);

        expect(next).toHaveBeenCalledWith(expected);
    });

    it('wraps POST handlers in one request-scoped transaction when writes mode is enabled', async () => {
        const { client, release, runtimeQuery } = setupTransactionalRuntime();
        const adapter = new ExpressAdapter();
        const routeHandler = adapter.adapt(
            async () => {
                const runtimeClient = await getTangoRuntime().getClient();
                await runtimeClient.query('INSERT INTO todos VALUES ($1)', [1]);
                return jsonResponse({ ok: true }, 201);
            },
            { transaction: 'writes' }
        );

        const req = anExpressRequest({ method: 'POST', originalUrl: '/todos', url: '/todos' });
        const res = anExpressResponse();
        const next = vi.fn() as unknown as NextFunction;

        await routeHandler(req, res, next);

        expect(client.begin).toHaveBeenCalledOnce();
        expect(client.query).toHaveBeenCalledWith('INSERT INTO todos VALUES ($1)', [1]);
        expect(client.commit).toHaveBeenCalledOnce();
        expect(client.rollback).not.toHaveBeenCalled();
        expect(runtimeQuery).not.toHaveBeenCalled();
        expect(release).toHaveBeenCalledOnce();
        expect(res.status).toHaveBeenCalledWith(201);
        expect(next).not.toHaveBeenCalled();
    });

    it('does not wrap GET handlers in a request transaction when writes mode is enabled', async () => {
        const { client, runtimeQuery } = setupTransactionalRuntime();
        const adapter = new ExpressAdapter();
        const routeHandler = adapter.adapt(
            async () => {
                const runtimeClient = await getTangoRuntime().getClient();
                await runtimeClient.query('SELECT 1');
                return jsonResponse({ ok: true }, 200);
            },
            { transaction: 'writes' }
        );

        const req = anExpressRequest({ method: 'GET', originalUrl: '/todos', url: '/todos' });
        const res = anExpressResponse();
        const next = vi.fn() as unknown as NextFunction;

        await routeHandler(req, res, next);

        expect(client.begin).not.toHaveBeenCalled();
        expect(client.commit).not.toHaveBeenCalled();
        expect(client.rollback).not.toHaveBeenCalled();
        expect(runtimeQuery).toHaveBeenCalledWith('SELECT 1', undefined);
        expect(next).not.toHaveBeenCalled();
    });

    it('rolls back request-scoped write transactions before forwarding handler errors', async () => {
        const { client, release, runtimeQuery } = setupTransactionalRuntime();
        const adapter = new ExpressAdapter();
        const expected = new Error('boom');
        const routeHandler = adapter.adapt(
            async () => {
                const runtimeClient = await getTangoRuntime().getClient();
                await runtimeClient.query('INSERT INTO todos VALUES ($1)', [1]);
                throw expected;
            },
            { transaction: 'writes' }
        );

        const req = anExpressRequest({ method: 'POST', originalUrl: '/todos', url: '/todos' });
        const res = anExpressResponse();
        const next = vi.fn() as unknown as NextFunction;

        await routeHandler(req, res, next);

        expect(client.begin).toHaveBeenCalledOnce();
        expect(client.query).toHaveBeenCalledWith('INSERT INTO todos VALUES ($1)', [1]);
        expect(client.rollback).toHaveBeenCalledOnce();
        expect(client.commit).not.toHaveBeenCalled();
        expect(runtimeQuery).not.toHaveBeenCalled();
        expect(release).toHaveBeenCalledOnce();
        expect(next).toHaveBeenCalledWith(expected);
    });

    it('keeps nested atomic work valid inside a wrapped write request', async () => {
        const { client } = setupTransactionalRuntime();
        const adapter = new ExpressAdapter();
        const routeHandler = adapter.adapt(
            async () => {
                await atomic(async () => {
                    const runtimeClient = await getTangoRuntime().getClient();
                    await runtimeClient.query('INSERT INTO todos VALUES ($1)', [1]);
                });
                return jsonResponse({ ok: true }, 201);
            },
            { transaction: 'writes' }
        );

        const req = anExpressRequest({ method: 'POST', originalUrl: '/todos', url: '/todos' });
        const res = anExpressResponse();
        const next = vi.fn() as unknown as NextFunction;

        await routeHandler(req, res, next);

        expect(client.begin).toHaveBeenCalledOnce();
        expect(client.createSavepoint).toHaveBeenCalledWith('tango_sp_0');
        expect(client.releaseSavepoint).toHaveBeenCalledWith('tango_sp_0');
        expect(client.commit).toHaveBeenCalledOnce();
        expect(next).not.toHaveBeenCalled();
    });

    it('sets JSON content-type for JSON-like bodies when absent', async () => {
        const adapter = new ExpressAdapter();
        const routeHandler = adapter.adapt(async (ctx) => {
            return textResponse(ctx.request.headers.get('content-type') ?? 'missing');
        });

        const req = anExpressRequest({
            method: 'POST',
            body: { name: 'Pedro', flags: [true, 1, 'x', null] },
            headers: {},
        });
        const res = anExpressResponse();
        const next = vi.fn() as unknown as NextFunction;

        await routeHandler(req, res, next);
        expect(res.send).toHaveBeenCalledWith('application/json; charset=utf-8');
    });

    it('passes through string bodies', async () => {
        const adapter = new ExpressAdapter();
        const routeHandler = adapter.adapt(async (ctx) => textResponse(await ctx.request.text()));
        const req = anExpressRequest({ method: 'POST', body: 'hello' });
        const res = anExpressResponse();
        const next = vi.fn() as unknown as NextFunction;

        await routeHandler(req, res, next);
        expect(res.send).toHaveBeenCalledWith('hello');
    });

    it('passes through Uint8Array bodies', async () => {
        const adapter = new ExpressAdapter();
        const routeHandler = adapter.adapt(async (ctx) => textResponse(await ctx.request.text()));
        const req = anExpressRequest({ method: 'POST', body: new Uint8Array([104, 105]) });
        const res = anExpressResponse();
        const next = vi.fn() as unknown as NextFunction;

        await routeHandler(req, res, next);
        expect(res.send).toHaveBeenCalledWith('hi');
    });

    it('passes through ArrayBuffer bodies', async () => {
        const adapter = new ExpressAdapter();
        const routeHandler = adapter.adapt(async (ctx) => bodyResponse(await ctx.request.arrayBuffer(), 200));
        const req = anExpressRequest({ method: 'POST', body: new TextEncoder().encode('ab').buffer });
        const res = anExpressResponse();
        const next = vi.fn() as unknown as NextFunction;

        await routeHandler(req, res, next);
        expect(res.send).toHaveBeenCalled();
    });

    it('drops unsupported non-json object bodies', async () => {
        const adapter = new ExpressAdapter();
        const routeHandler = adapter.adapt(async (ctx) => textResponse(await ctx.request.text()));
        const req = anExpressRequest({
            method: 'POST',
            body: { bad: Symbol('x') } as unknown,
        });
        const res = anExpressResponse();
        const next = vi.fn() as unknown as NextFunction;

        await routeHandler(req, res, next);
        expect(res.send).toHaveBeenCalledWith('');
    });

    it('normalizes array params and falls back to empty string for empty arrays', async () => {
        const adapter = new ExpressAdapter();
        const routeHandler = adapter.adapt(async (ctx) => {
            return jsonResponse(ctx.params, 200);
        });

        const req = anExpressRequest({
            method: 'GET',
            params: {
                first: ['one'] as unknown as string,
                second: [] as unknown as string,
            } as unknown as Request['params'],
        });
        const res = anExpressResponse();
        const next = vi.fn() as unknown as NextFunction;

        await routeHandler(req, res, next);
        expect(res.send).toHaveBeenCalledWith(JSON.stringify({ first: 'one', second: '' }));
    });

    it('uses http/localhost/url fallbacks when protocol, host, and originalUrl are missing', async () => {
        const adapter = new ExpressAdapter();
        const routeHandler = adapter.adapt(async (ctx) => textResponse(ctx.request.url));
        const req = anExpressRequest({
            method: 'GET',
            protocol: '' as unknown as Request['protocol'],
            originalUrl: '' as unknown as Request['originalUrl'],
            url: '/fallback',
            get: vi.fn(() => undefined),
        });
        const res = anExpressResponse();
        const next = vi.fn() as unknown as NextFunction;

        await routeHandler(req, res, next);
        expect(res.send).toHaveBeenCalledWith('http://localhost/fallback');
    });

    it('registers all CRUD routes with a single call', async () => {
        const adapter = new ExpressAdapter();
        const registrar = {
            get: vi.fn(),
            post: vi.fn(),
            patch: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
        };
        const viewset = {
            list: vi.fn(async () => emptyResponse(200)),
            create: vi.fn(async () => emptyResponse(201)),
            retrieve: vi.fn(async () => emptyResponse(200)),
            update: vi.fn(async () => emptyResponse(200)),
            destroy: vi.fn(async () => emptyResponse(204)),
        };

        adapter.registerViewSet(registrar, '/api/posts', viewset);

        expect(registrar.get).toHaveBeenCalledTimes(2);
        expect(registrar.post).toHaveBeenCalledTimes(1);
        expect(registrar.patch).toHaveBeenCalledTimes(1);
        expect(registrar.put).toHaveBeenCalledTimes(1);
        expect(registrar.delete).toHaveBeenCalledTimes(1);
        expect(registrar.get).toHaveBeenNthCalledWith(1, '/api/posts', expect.any(Function));
        expect(registrar.get).toHaveBeenNthCalledWith(2, '/api/posts/:id', expect.any(Function));

        const next = vi.fn() as unknown as NextFunction;

        const listHandler = getRegisteredHandler(registrar.get, 0);
        await listHandler(anExpressRequest({ method: 'GET', originalUrl: '/', url: '/' }), anExpressResponse(), next);

        const createHandler = getRegisteredHandler(registrar.post, 0);
        await createHandler(
            anExpressRequest({ method: 'POST', body: {}, originalUrl: '/', url: '/' }),
            anExpressResponse(),
            next
        );

        const retrieveHandler = getRegisteredHandler(registrar.get, 1);
        await retrieveHandler(
            anExpressRequest({ method: 'GET', params: { id: '10' }, originalUrl: '/', url: '/' }),
            anExpressResponse(),
            next
        );

        const patchHandler = getRegisteredHandler(registrar.patch, 0);
        await patchHandler(
            anExpressRequest({ method: 'PATCH', params: { id: '10' }, body: {}, originalUrl: '/', url: '/' }),
            anExpressResponse(),
            next
        );

        const putHandler = getRegisteredHandler(registrar.put, 0);
        await putHandler(
            anExpressRequest({ method: 'PUT', params: { id: '10' }, body: {}, originalUrl: '/', url: '/' }),
            anExpressResponse(),
            next
        );

        const deleteHandler = getRegisteredHandler(registrar.delete, 0);
        await deleteHandler(
            anExpressRequest({ method: 'DELETE', params: { id: '10' }, originalUrl: '/', url: '/' }),
            anExpressResponse(),
            next
        );

        expect(viewset.list).toHaveBeenCalledTimes(1);
        expect(viewset.create).toHaveBeenCalledTimes(1);
        expect(viewset.retrieve).toHaveBeenCalledTimes(1);
        expect(viewset.update).toHaveBeenCalledTimes(2);
        expect(viewset.destroy).toHaveBeenCalledTimes(1);
    });

    it('registers root-scoped routes for blank and slash base paths', () => {
        const adapter = new ExpressAdapter();
        const makeRegistrar = () => ({
            get: vi.fn(),
            post: vi.fn(),
            patch: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
        });
        const viewset = {
            list: vi.fn(async () => emptyResponse(200)),
            create: vi.fn(async () => emptyResponse(201)),
            retrieve: vi.fn(async () => emptyResponse(200)),
            update: vi.fn(async () => emptyResponse(200)),
            destroy: vi.fn(async () => emptyResponse(204)),
        };

        const blankRegistrar = makeRegistrar();
        adapter.registerViewSet(blankRegistrar, '   ', viewset);
        expect(blankRegistrar.get).toHaveBeenNthCalledWith(1, '/', expect.any(Function));
        expect(blankRegistrar.get).toHaveBeenNthCalledWith(2, '/:id', expect.any(Function));

        const slashRegistrar = makeRegistrar();
        adapter.registerViewSet(slashRegistrar, '/', viewset);
        expect(slashRegistrar.get).toHaveBeenNthCalledWith(1, '/', expect.any(Function));
        expect(slashRegistrar.get).toHaveBeenNthCalledWith(2, '/:id', expect.any(Function));

        const noLeadingSlashRegistrar = makeRegistrar();
        adapter.registerViewSet(noLeadingSlashRegistrar, 'api/posts', viewset);
        expect(noLeadingSlashRegistrar.get).toHaveBeenNthCalledWith(1, '/api/posts', expect.any(Function));
    });

    it('creates an express router with all CRUD handlers', () => {
        const adapter = new ExpressAdapter();
        const viewset = {
            list: vi.fn(async () => emptyResponse(200)),
            create: vi.fn(async () => emptyResponse(201)),
            retrieve: vi.fn(async () => emptyResponse(200)),
            update: vi.fn(async () => emptyResponse(200)),
            destroy: vi.fn(async () => emptyResponse(204)),
        };

        const router = adapter.createViewSetRouter(viewset);
        expect(router).toBeDefined();
        expect(typeof router).toBe('function');
    });

    it('registers and dispatches custom detail and collection actions', async () => {
        const adapter = new ExpressAdapter();
        const registrar = {
            get: vi.fn(),
            post: vi.fn(),
            patch: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
        };

        class ActionViewSet {
            list = vi.fn(async () => emptyResponse(200));
            create = vi.fn(async () => emptyResponse(201));
            retrieve = vi.fn(async () => emptyResponse(200));
            update = vi.fn(async () => emptyResponse(200));
            destroy = vi.fn(async () => emptyResponse(204));
            activateAccount = vi.fn(async (_ctx: unknown, id: string) => {
                return jsonResponse({ id, active: true }, 200);
            });
            metrics = vi.fn(async () => {
                return jsonResponse({ total: 12 }, 200);
            });

            static getActions() {
                return [
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
                ] as const;
            }
        }

        const viewset = new ActionViewSet();
        adapter.registerViewSet(registrar, '/api/users', viewset);

        expect(registrar.post).toHaveBeenCalledWith('/api/users/:id/activate-account', expect.any(Function));
        expect(registrar.get).toHaveBeenCalledWith('/api/users/metrics/daily', expect.any(Function));

        const next = vi.fn() as unknown as NextFunction;
        const detailActionHandler = findRegisteredHandler(registrar.post, '/api/users/:id/activate-account');
        await detailActionHandler(
            anExpressRequest({ method: 'POST', params: { id: '42' }, originalUrl: '/', url: '/' }),
            anExpressResponse(),
            next
        );

        expect(viewset.activateAccount).toHaveBeenCalledTimes(1);
        expect(viewset.activateAccount.mock.calls[0]?.[1]).toBe('42');

        const collectionActionHandler = findRegisteredHandler(registrar.get, '/api/users/metrics/daily');
        await collectionActionHandler(
            anExpressRequest({ method: 'GET', originalUrl: '/', url: '/' }),
            anExpressResponse(),
            next
        );

        expect(viewset.metrics).toHaveBeenCalledTimes(1);
    });

    it('supports root-scoped action paths, PATCH/PUT/DELETE action methods, and missing action handlers', async () => {
        const adapter = new ExpressAdapter();
        const registrar = {
            get: vi.fn(),
            post: vi.fn(),
            patch: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
        };

        class ActionViewSet {
            list = vi.fn(async () => emptyResponse(200));
            create = vi.fn(async () => emptyResponse(201));
            retrieve = vi.fn(async () => emptyResponse(200));
            update = vi.fn(async () => emptyResponse(200));
            destroy = vi.fn(async () => emptyResponse(204));
            bulkReindex = vi.fn(async () => jsonResponse({ ok: true }, 200));

            static getActions() {
                return [
                    {
                        name: 'bulkReindex',
                        scope: 'collection',
                        methods: ['PATCH', 'PUT', 'DELETE'],
                        path: 'ops/reindex',
                    },
                    {
                        name: 'missingCollectionAction',
                        scope: 'collection',
                        methods: ['GET'],
                        path: 'missing-collection',
                    },
                    {
                        name: 'missingDetailAction',
                        scope: 'detail',
                        methods: ['POST'],
                        path: 'missing',
                    },
                ] as const;
            }
        }

        const viewset = new ActionViewSet();
        adapter.registerViewSet(registrar, '/', viewset);

        expect(registrar.patch).toHaveBeenCalledWith('/ops/reindex', expect.any(Function));
        expect(registrar.put).toHaveBeenCalledWith('/ops/reindex', expect.any(Function));
        expect(registrar.delete).toHaveBeenCalledWith('/ops/reindex', expect.any(Function));

        const next = vi.fn() as unknown as NextFunction;
        const missingActionHandler = findRegisteredHandler(registrar.post, '/:id/missing');
        await missingActionHandler(
            anExpressRequest({ method: 'POST', params: { id: '5' }, originalUrl: '/', url: '/' }),
            anExpressResponse(),
            next
        );

        const missingCollectionHandler = findRegisteredHandler(registrar.get, '/missing-collection');
        await missingCollectionHandler(
            anExpressRequest({ method: 'GET', originalUrl: '/', url: '/' }),
            anExpressResponse(),
            next
        );

        expect(next).toHaveBeenCalledTimes(2);
        expect(vi.mocked(next).mock.calls[0]?.[0]).toBeInstanceOf(Error);
        expect(vi.mocked(next).mock.calls[1]?.[0]).toBeInstanceOf(Error);
    });
});

describe('APIView integration', () => {
    it('createAPIViewRouter builds a router instance', () => {
        const adapter = new ExpressAdapter();
        const router = adapter.createAPIViewRouter({
            dispatch: vi.fn(async () => emptyResponse(200)),
        });
        expect(router).toBeDefined();
    });

    it('routes API view requests through one registered path', async () => {
        const apiView = {
            dispatch: vi.fn(async () => jsonResponse({ ok: true }, 200)),
        };

        const adapter = new ExpressAdapter();
        const registrar = {
            get: vi.fn(),
            post: vi.fn(),
            patch: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
        };

        adapter.registerAPIView(registrar, '/api/healthz', apiView);

        expect(registrar.get).toHaveBeenCalledWith('/api/healthz', expect.any(Function));
        expect(registrar.post).toHaveBeenCalledWith('/api/healthz', expect.any(Function));
        expect(registrar.patch).toHaveBeenCalledWith('/api/healthz', expect.any(Function));
        expect(registrar.put).toHaveBeenCalledWith('/api/healthz', expect.any(Function));
        expect(registrar.delete).toHaveBeenCalledWith('/api/healthz', expect.any(Function));

        const handler = getRegisteredHandler(registrar.get, 0);
        await handler(
            anExpressRequest({ method: 'GET', originalUrl: '/', url: '/' }),
            anExpressResponse(),
            vi.fn() as NextFunction
        );
        const postHandler = getRegisteredHandler(registrar.post, 0);
        await postHandler(
            anExpressRequest({ method: 'POST', body: { ping: true }, originalUrl: '/', url: '/' }),
            anExpressResponse(),
            vi.fn() as NextFunction
        );
        const putHandler = getRegisteredHandler(registrar.put, 0);
        await putHandler(
            anExpressRequest({ method: 'PUT', body: { ping: true }, originalUrl: '/', url: '/' }),
            anExpressResponse(),
            vi.fn() as NextFunction
        );
        const patchHandler = getRegisteredHandler(registrar.patch, 0);
        await patchHandler(
            anExpressRequest({ method: 'PATCH', body: { ping: true }, originalUrl: '/', url: '/' }),
            anExpressResponse(),
            vi.fn() as NextFunction
        );
        const deleteHandler = getRegisteredHandler(registrar.delete, 0);
        await deleteHandler(
            anExpressRequest({ method: 'DELETE', originalUrl: '/', url: '/' }),
            anExpressResponse(),
            vi.fn() as NextFunction
        );
        expect(apiView.dispatch).toHaveBeenCalled();
    });

    it('routes generic API views through collection and detail paths', async () => {
        const apiView = {
            dispatch: vi.fn(async () => jsonResponse({ ok: true }, 200)),
        };

        const adapter = new ExpressAdapter();
        const registrar = {
            get: vi.fn(),
            post: vi.fn(),
            patch: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
        };

        adapter.registerGenericAPIView(registrar, '/api/generic/users', '/api/generic/users/:id', apiView);

        expect(registrar.get).toHaveBeenCalledWith('/api/generic/users', expect.any(Function));
        expect(registrar.post).toHaveBeenCalledWith('/api/generic/users', expect.any(Function));
        expect(registrar.get).toHaveBeenCalledWith('/api/generic/users/:id', expect.any(Function));
        expect(registrar.put).toHaveBeenCalledWith('/api/generic/users/:id', expect.any(Function));
        expect(registrar.patch).toHaveBeenCalledWith('/api/generic/users/:id', expect.any(Function));
        expect(registrar.delete).toHaveBeenCalledWith('/api/generic/users/:id', expect.any(Function));

        const collectionGet = getRegisteredHandler(registrar.get, 0);
        await collectionGet(
            anExpressRequest({ method: 'GET', originalUrl: '/api/generic/users', url: '/api/generic/users' }),
            anExpressResponse(),
            vi.fn() as NextFunction
        );

        const detailPatch = getRegisteredHandler(registrar.patch, 0);
        await detailPatch(
            anExpressRequest({
                method: 'PATCH',
                params: { id: '1' },
                originalUrl: '/api/generic/users/1',
                url: '/api/generic/users/1',
            }),
            anExpressResponse(),
            vi.fn() as NextFunction
        );

        const collectionPost = getRegisteredHandler(registrar.post, 0);
        await collectionPost(
            anExpressRequest({
                method: 'POST',
                body: { username: 'a' },
                originalUrl: '/api/generic/users',
                url: '/api/generic/users',
            }),
            anExpressResponse(),
            vi.fn() as NextFunction
        );

        const detailPut = getRegisteredHandler(registrar.put, 0);
        await detailPut(
            anExpressRequest({
                method: 'PUT',
                params: { id: '1' },
                body: { username: 'a' },
                originalUrl: '/api/generic/users/1',
                url: '/api/generic/users/1',
            }),
            anExpressResponse(),
            vi.fn() as NextFunction
        );

        const detailDelete = getRegisteredHandler(registrar.delete, 0);
        await detailDelete(
            anExpressRequest({
                method: 'DELETE',
                params: { id: '1' },
                originalUrl: '/api/generic/users/1',
                url: '/api/generic/users/1',
            }),
            anExpressResponse(),
            vi.fn() as NextFunction
        );

        expect(apiView.dispatch).toHaveBeenCalledTimes(5);
    });

    it('registerGenericAPIView derives a default detail path when omitted', async () => {
        const apiView = {
            dispatch: vi.fn(async () => jsonResponse({ ok: true }, 200)),
        };
        const adapter = new ExpressAdapter();
        const registrar = {
            get: vi.fn(),
            post: vi.fn(),
            patch: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
        };

        adapter.registerGenericAPIView(registrar, '/api/generic/posts', undefined, apiView);
        expect(registrar.get).toHaveBeenCalledWith('/api/generic/posts/:id', expect.any(Function));

        const detailGet = findRegisteredHandler(registrar.get, '/api/generic/posts/:id');
        await detailGet(
            anExpressRequest({
                method: 'GET',
                params: { id: '123' },
                originalUrl: '/api/generic/posts/123',
                url: '/api/generic/posts/123',
            }),
            anExpressResponse(),
            vi.fn() as NextFunction
        );
        expect(apiView.dispatch).toHaveBeenCalled();
    });
});
