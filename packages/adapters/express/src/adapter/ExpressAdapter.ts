import type { Request as ExpressRequest, Response as ExpressResponse, NextFunction, RequestHandler } from 'express';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { Router } from 'express';
import { RequestContext } from '@danceroutine/tango-resources';
import { TangoQueryParams, TangoResponse } from '@danceroutine/tango-core';
import {
    FRAMEWORK_ADAPTER_BRAND,
    FrameworkAdapterRequestExecutor,
    type FrameworkAdapter,
    type FrameworkAdapterOptions,
} from '@danceroutine/tango-adapters-core/adapter';

type ViewSetActionMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type ResolvedViewSetActionDescriptor = {
    name: string;
    scope: 'detail' | 'collection';
    methods: readonly ViewSetActionMethod[];
    path: string;
};

/**
 * Adapter options for Express integration.
 */
export type AdaptExpressOptions = FrameworkAdapterOptions<ExpressRequest>;

/**
 * Minimal CRUD viewset contract used by adapter route registration helpers.
 */
export interface ExpressCrudViewSet {
    list(ctx: RequestContext): Promise<TangoResponse>;
    create(ctx: RequestContext): Promise<TangoResponse>;
    retrieve(ctx: RequestContext, id: string): Promise<TangoResponse>;
    update(ctx: RequestContext, id: string): Promise<TangoResponse>;
    destroy(ctx: RequestContext, id: string): Promise<TangoResponse>;
}

export interface ExpressAPIView {
    dispatch(ctx: RequestContext): Promise<TangoResponse>;
}

/**
 * Minimal route registrar interface implemented by Express apps and routers.
 */
export interface ExpressRouteRegistrar {
    get(path: string, handler: RequestHandler): unknown;
    post(path: string, handler: RequestHandler): unknown;
    patch(path: string, handler: RequestHandler): unknown;
    put(path: string, handler: RequestHandler): unknown;
    delete(path: string, handler: RequestHandler): unknown;
}

/**
 * Express adapter that translates Express handlers to Tango `RequestContext`.
 */
export class ExpressAdapter implements FrameworkAdapter<Response, RequestHandler, ExpressRequest> {
    readonly __tangoBrand: typeof FRAMEWORK_ADAPTER_BRAND = FRAMEWORK_ADAPTER_BRAND;
    private readonly requestExecutor = new FrameworkAdapterRequestExecutor();

    /**
     * Normalize an Express request into Tango query params.
     */
    toQueryParams(req: ExpressRequest): TangoQueryParams {
        const request = this.toRequestFromExpress(req);
        return TangoQueryParams.fromRequest(request);
    }

    /**
     * Adapt a Tango-style handler into an Express request handler.
     */
    adapt(
        handler: (ctx: RequestContext, ...args: unknown[]) => Promise<TangoResponse>,
        options: AdaptExpressOptions = {}
    ): RequestHandler {
        return this.createHandler(handler, options);
    }

    /**
     * Build an Express router that wires all CRUD routes for a viewset.
     */
    createViewSetRouter(viewset: ExpressCrudViewSet, options: AdaptExpressOptions = {}): Router {
        const router = Router();
        this.registerViewSet(router, '', viewset, options);
        return router;
    }

    /**
     * Build an Express router for a single-path APIView.
     */
    createAPIViewRouter(apiView: ExpressAPIView, options: AdaptExpressOptions = {}): Router {
        const router = Router();
        this.registerAPIView(router, '', apiView, options);
        return router;
    }

    /**
     * Register all CRUD routes for a viewset under a base path.
     */
    registerViewSet(
        registrar: ExpressRouteRegistrar,
        basePath: string,
        viewset: ExpressCrudViewSet,
        options: AdaptExpressOptions = {}
    ): void {
        const collectionPath = this.normalizeBasePath(basePath);
        const detailPath = collectionPath === '/' ? '/:id' : `${collectionPath}/:id`;

        registrar.get(
            collectionPath,
            this.adapt((ctx) => viewset.list(ctx), options)
        );
        registrar.post(
            collectionPath,
            this.adapt((ctx) => viewset.create(ctx), options)
        );
        registrar.get(
            detailPath,
            this.adapt((ctx, id) => viewset.retrieve(ctx, String(id)), options)
        );
        registrar.patch(
            detailPath,
            this.adapt((ctx, id) => viewset.update(ctx, String(id)), options)
        );
        registrar.put(
            detailPath,
            this.adapt((ctx, id) => viewset.update(ctx, String(id)), options)
        );
        registrar.delete(
            detailPath,
            this.adapt((ctx, id) => viewset.destroy(ctx, String(id)), options)
        );

        const actions = this.getViewSetActions(viewset);
        actions.forEach((action) => {
            const actionPath =
                action.scope === 'detail'
                    ? this.joinPath(detailPath, action.path)
                    : this.joinPath(collectionPath, action.path);
            const handler =
                action.scope === 'detail'
                    ? this.adapt((ctx, id) => this.invokeDetailAction(viewset, action, ctx, String(id)), options)
                    : this.adapt((ctx) => this.invokeCollectionAction(viewset, action, ctx), options);

            this.registerActionMethods(registrar, action.methods, actionPath, handler);
        });
    }

    /**
     * Register one APIView on a single path and dispatch by HTTP method.
     */
    registerAPIView(
        registrar: ExpressRouteRegistrar,
        path: string,
        apiView: ExpressAPIView,
        options: AdaptExpressOptions = {}
    ): void {
        const normalizedPath = this.normalizeBasePath(path);
        this.registerAllMethods(
            registrar,
            normalizedPath,
            this.adapt((ctx) => apiView.dispatch(ctx), options)
        );
    }

    /**
     * Register one GenericAPIView with collection and detail routes.
     */
    registerGenericAPIView(
        registrar: ExpressRouteRegistrar,
        collectionPath: string,
        detailPath: string | undefined,
        apiView: ExpressAPIView,
        options: AdaptExpressOptions = {}
    ): void {
        const normalizedCollectionPath = this.normalizeBasePath(collectionPath);
        const normalizedDetailPath = detailPath?.trim().length
            ? this.normalizeBasePath(detailPath)
            : this.joinPath(normalizedCollectionPath, ':id');

        registrar.get(
            normalizedCollectionPath,
            this.adapt((ctx) => apiView.dispatch(ctx), options)
        );
        registrar.post(
            normalizedCollectionPath,
            this.adapt((ctx) => apiView.dispatch(ctx), options)
        );
        registrar.get(
            normalizedDetailPath,
            this.adapt((ctx) => apiView.dispatch(ctx), options)
        );
        registrar.put(
            normalizedDetailPath,
            this.adapt((ctx) => apiView.dispatch(ctx), options)
        );
        registrar.patch(
            normalizedDetailPath,
            this.adapt((ctx) => apiView.dispatch(ctx), options)
        );
        registrar.delete(
            normalizedDetailPath,
            this.adapt((ctx) => apiView.dispatch(ctx), options)
        );
    }

    private invokeDetailAction(
        viewset: ExpressCrudViewSet,
        action: ResolvedViewSetActionDescriptor,
        ctx: RequestContext,
        id: string
    ): Promise<TangoResponse> {
        const candidate = (viewset as unknown as Record<string, unknown>)[action.name];
        if (typeof candidate !== 'function') {
            throw new TypeError(`Missing detail action method '${action.name}' on viewset.`);
        }
        return (
            candidate as (this: ExpressCrudViewSet, ctx: RequestContext, id: string) => Promise<TangoResponse>
        ).call(viewset, ctx, id);
    }

    private invokeCollectionAction(
        viewset: ExpressCrudViewSet,
        action: ResolvedViewSetActionDescriptor,
        ctx: RequestContext
    ): Promise<TangoResponse> {
        const candidate = (viewset as unknown as Record<string, unknown>)[action.name];
        if (typeof candidate !== 'function') {
            throw new TypeError(`Missing collection action method '${action.name}' on viewset.`);
        }
        return (candidate as (this: ExpressCrudViewSet, ctx: RequestContext) => Promise<TangoResponse>).call(
            viewset,
            ctx
        );
    }

    private createHandler(
        handler: (ctx: RequestContext, ...args: unknown[]) => Promise<TangoResponse>,
        options: AdaptExpressOptions
    ): RequestHandler {
        return async (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
            try {
                const user = options.getUser ? await options.getUser(req) : null;

                const request = this.toRequestFromExpress(req);
                const ctx = RequestContext.create(request, user);
                ctx.params = this.normalizeParams(req.params);

                const rawId = req.params.id;
                const id = Array.isArray(rawId) ? rawId[0] : rawId;
                const tangoResponse = await this.requestExecutor.forHandler({ handler, ctx, id }).runResponse(
                    req.method,
                    options.transaction
                );
                const response = tangoResponse.toWebResponse();

                res.status(response.status);

                response.headers.forEach((value, key) => {
                    res.setHeader(key, value);
                });

                if (response.body === null) {
                    res.end();
                    return;
                }

                if (tangoResponse.body !== null) {
                    await this.pipeReadableStream(response.body, res);
                    return;
                }

                const body = new Uint8Array<ArrayBuffer>(await response.arrayBuffer());
                res.send(this.normalizeResponseBody(body, response.headers));
            } catch (error) {
                next(error);
            }
        };
    }

    private async pipeReadableStream(
        body: ReadableStream<Uint8Array<ArrayBuffer>>,
        res: ExpressResponse
    ): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            const stream = Readable.fromWeb(body as unknown as NodeReadableStream);
            stream.on('error', reject);
            res.on('error', reject);
            res.on('finish', () => resolve());
            stream.pipe(res);
        });
    }

    private normalizeResponseBody(body: Uint8Array<ArrayBuffer>, headers: Headers): string | Buffer {
        const contentType = headers.get('content-type')?.toLowerCase() ?? '';
        if (contentType.startsWith('text/') || contentType.includes('json')) {
            return new TextDecoder().decode(body);
        }

        return Buffer.from(body);
    }

    private normalizeParams(params: Record<string, string | string[]>): Record<string, string> {
        return Object.fromEntries(
            Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? (value[0] ?? '') : value])
        );
    }

    private toRequestFromExpress(req: ExpressRequest): Request {
        const protocol = req.protocol || 'http';
        const host = req.get('host') || 'localhost';
        const url = `${protocol}://${host}${req.originalUrl || req.url}`;
        const headers = new Headers(req.headers as HeadersInit);
        const body = this.normalizeBody(req);

        if (body !== undefined && !headers.has('content-type') && this.isJsonLike(req.body)) {
            headers.set('content-type', 'application/json; charset=utf-8');
        }

        return new Request(url, {
            method: req.method,
            headers,
            body,
        });
    }

    private normalizeBody(req: ExpressRequest): BodyInit | null | undefined {
        if (['GET', 'HEAD'].includes(req.method)) {
            return undefined;
        }

        if (req.body === null || req.body === undefined) {
            return undefined;
        }

        if (
            typeof req.body === 'string' ||
            this.hasTag(req.body, 'Uint8Array') ||
            this.hasTag(req.body, 'ArrayBuffer')
        ) {
            return req.body;
        }

        if (this.isJsonLike(req.body)) {
            return JSON.stringify(req.body);
        }

        return undefined;
    }

    private isJsonLike(value: unknown): boolean {
        if (value === null) return true;
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true;
        if (Array.isArray(value)) return value.every((item) => this.isJsonLike(item));
        if (typeof value === 'object') {
            return Object.values(value as Record<string, unknown>).every((item) => this.isJsonLike(item));
        }
        return false;
    }

    private hasTag(value: unknown, tag: string): boolean {
        return value !== null && value !== undefined && Object.prototype.toString.call(value) === `[object ${tag}]`;
    }

    private registerMethod(
        registrar: ExpressRouteRegistrar,
        method: ViewSetActionMethod,
        path: string,
        handler: RequestHandler
    ): void {
        switch (method) {
            case 'GET':
                registrar.get(path, handler);
                return;
            case 'POST':
                registrar.post(path, handler);
                return;
            case 'PATCH':
                registrar.patch(path, handler);
                return;
            case 'PUT':
                registrar.put(path, handler);
                return;
            default:
                registrar.delete(path, handler);
        }
    }

    private normalizeBasePath(basePath: string): string {
        const trimmed = basePath.trim();
        if (!trimmed || trimmed === '/') {
            return '/';
        }
        return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    }

    private joinPath(base: string, subPath: string): string {
        const normalizedSubPath = subPath.replace(/^\/+|\/+$/g, '');
        return base === '/' ? `/${normalizedSubPath}` : `${base}/${normalizedSubPath}`;
    }

    private registerActionMethods(
        registrar: ExpressRouteRegistrar,
        methods: readonly ViewSetActionMethod[],
        path: string,
        handler: RequestHandler
    ): void {
        for (const method of methods) {
            this.registerMethod(registrar, method, path, handler);
        }
    }

    private registerAllMethods(registrar: ExpressRouteRegistrar, path: string, handler: RequestHandler): void {
        this.registerMethod(registrar, 'GET', path, handler);
        this.registerMethod(registrar, 'POST', path, handler);
        this.registerMethod(registrar, 'PUT', path, handler);
        this.registerMethod(registrar, 'PATCH', path, handler);
        this.registerMethod(registrar, 'DELETE', path, handler);
    }

    private getViewSetActions(viewset: ExpressCrudViewSet): readonly ResolvedViewSetActionDescriptor[] {
        const constructorValue = viewset.constructor as {
            getActions?: (input: ExpressCrudViewSet) => readonly ResolvedViewSetActionDescriptor[];
        };

        if (typeof constructorValue.getActions !== 'function') {
            return [];
        }

        return constructorValue.getActions(viewset);
    }
}
