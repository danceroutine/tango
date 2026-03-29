import type { NextRequest } from 'next/server';
import { RequestContext } from '@danceroutine/tango-resources';
import {
    HttpErrorFactory,
    TangoQueryParams,
    TangoRequest,
    TangoResponse,
    getLogger,
    type JsonValue,
} from '@danceroutine/tango-core';
import {
    FRAMEWORK_ADAPTER_BRAND,
    type FrameworkAdapter,
    type FrameworkAdapterOptions,
} from '@danceroutine/tango-adapters-core/adapter';
import { InternalHttpMethod, InternalActionScope, InternalActionMatchKind } from '@danceroutine/tango-adapters-core';

type HttpMethod = (typeof InternalHttpMethod)[keyof typeof InternalHttpMethod];
type ActionScope = (typeof InternalActionScope)[keyof typeof InternalActionScope];

type ResolvedViewSetActionDescriptor = {
    name: string;
    scope: ActionScope;
    methods: readonly HttpMethod[];
    path: string;
};

/**
 * Next.js route handler signature produced by the adapter.
 */
export type NextRouteHandler = (
    request: NextRequest,
    context?: { params?: Promise<Record<string, string | string[]>> }
) => Promise<Response>;

export type NextDynamicRouteContext = {
    params: Promise<Record<string, string | string[]>>;
};

export type NextDynamicRouteHandler = (request: NextRequest, context: NextDynamicRouteContext) => Promise<Response>;

/**
 * Adapter options for Next.js integration.
 */
export type AdaptNextOptions = FrameworkAdapterOptions<NextRequest>;

/**
 * Minimal CRUD viewset contract used by the Next adapter route helpers.
 */
export interface NextCrudViewSet {
    list(ctx: RequestContext): Promise<TangoResponse>;
    create(ctx: RequestContext): Promise<TangoResponse>;
    retrieve(ctx: RequestContext, id: string): Promise<TangoResponse>;
    update(ctx: RequestContext, id: string): Promise<TangoResponse>;
    destroy(ctx: RequestContext, id: string): Promise<TangoResponse>;
}

export interface NextAPIView {
    dispatch(ctx: RequestContext): Promise<TangoResponse>;
}

export type NextViewSetFactory = () => NextCrudViewSet | Promise<NextCrudViewSet>;
export type NextAPIViewFactory = () => NextAPIView | Promise<NextAPIView>;

/**
 * Options for auto-generated viewset route handlers.
 */
export type AdaptNextViewSetOptions = AdaptNextOptions & {
    paramKey?: string;
};

/**
 * HTTP method handlers generated from a CRUD viewset.
 */
export interface NextViewSetRouteHandlers {
    GET: NextDynamicRouteHandler;
    POST: NextDynamicRouteHandler;
    PATCH: NextDynamicRouteHandler;
    PUT: NextDynamicRouteHandler;
    DELETE: NextDynamicRouteHandler;
}

type ActionMatch =
    | { kind: typeof InternalActionMatchKind.DETAIL; action: ResolvedViewSetActionDescriptor; id: string }
    | { kind: typeof InternalActionMatchKind.COLLECTION; action: ResolvedViewSetActionDescriptor }
    | { kind: typeof InternalActionMatchKind.METHOD_NOT_ALLOWED };

/**
 * Next.js adapter that translates route handlers to Tango `RequestContext`.
 */
export class NextAdapter implements FrameworkAdapter<Response, NextRouteHandler, NextRequest> {
    readonly __tangoBrand: typeof FRAMEWORK_ADAPTER_BRAND = FRAMEWORK_ADAPTER_BRAND;
    private readonly logger = getLogger('tango.adapter.next');
    /**
     * Normalize Next.js-style route search params into Tango query params.
     */
    toQueryParams(searchParams: Record<string, string | string[] | undefined>): TangoQueryParams {
        return TangoQueryParams.fromRecord(searchParams);
    }

    /**
     * Adapt a Tango-style handler into a Next.js route handler.
     */
    adapt(
        handler: (ctx: RequestContext, ...args: unknown[]) => Promise<TangoResponse>,
        options: AdaptNextOptions = {}
    ): NextRouteHandler {
        return this.createHandler(handler, options);
    }

    /**
     * Build Next route handlers that map HTTP verbs to standard CRUD viewset actions.
     */
    adaptViewSet(viewset: NextCrudViewSet, options: AdaptNextViewSetOptions = {}): NextViewSetRouteHandlers {
        const paramKey = options.paramKey ?? 'tango';
        return {
            GET: this.adapt(
                (ctx) =>
                    this.dispatchViewSetAction(viewset, InternalHttpMethod.GET, ctx, paramKey, (segments, directId) => {
                        if (directId) return viewset.retrieve(ctx, directId);
                        if (segments.length === 0) return viewset.list(ctx);
                        if (segments.length === 1) return viewset.retrieve(ctx, segments[0] as string);
                        return this.notFoundResponse();
                    }),
                options
            ),
            POST: this.adapt(
                (ctx) =>
                    this.dispatchViewSetAction(
                        viewset,
                        InternalHttpMethod.POST,
                        ctx,
                        paramKey,
                        (segments, directId) => {
                            if (segments.length === 0 && !directId) return viewset.create(ctx);
                            return this.methodNotAllowedResponse();
                        }
                    ),
                options
            ),
            PATCH: this.adapt(
                (ctx) =>
                    this.dispatchViewSetAction(
                        viewset,
                        InternalHttpMethod.PATCH,
                        ctx,
                        paramKey,
                        (segments, directId) => {
                            const id = directId ?? segments[0];
                            return id ? viewset.update(ctx, id) : this.methodNotAllowedResponse();
                        }
                    ),
                options
            ),
            PUT: this.adapt(
                (ctx) =>
                    this.dispatchViewSetAction(viewset, InternalHttpMethod.PUT, ctx, paramKey, (segments, directId) => {
                        const id = directId ?? segments[0];
                        return id ? viewset.update(ctx, id) : this.methodNotAllowedResponse();
                    }),
                options
            ),
            DELETE: this.adapt(
                (ctx) =>
                    this.dispatchViewSetAction(
                        viewset,
                        InternalHttpMethod.DELETE,
                        ctx,
                        paramKey,
                        (segments, directId) => {
                            const id = directId ?? segments[0];
                            return id ? viewset.destroy(ctx, id) : this.methodNotAllowedResponse();
                        }
                    ),
                options
            ),
        };
    }

    /**
     * Build Next route handlers from a lazy viewset factory and memoize initialization.
     * Initialization failures clear the memoized promise so subsequent requests can retry.
     */
    adaptViewSetFactory(factory: NextViewSetFactory, options: AdaptNextViewSetOptions = {}): NextViewSetRouteHandlers {
        return this.adaptRouteHandlersFactory(async () => {
            const viewset = await factory();
            return this.adaptViewSet(viewset, options);
        });
    }

    /**
     * Build Next route handlers from a lazy GenericAPIView factory and memoize initialization.
     */
    adaptGenericAPIViewFactory(
        factory: NextAPIViewFactory,
        options: AdaptNextViewSetOptions = {}
    ): NextViewSetRouteHandlers {
        return this.adaptRouteHandlersFactory(async () => {
            const apiView = await factory();
            return this.adaptGenericAPIView(apiView, options);
        });
    }

    /**
     * Build Next route handlers that dispatch an APIView by HTTP method.
     */
    adaptAPIView(apiView: NextAPIView, options: AdaptNextOptions = {}): NextViewSetRouteHandlers {
        return {
            GET: this.adapt((ctx) => apiView.dispatch(ctx), options),
            POST: this.adapt((ctx) => apiView.dispatch(ctx), options),
            PATCH: this.adapt((ctx) => apiView.dispatch(ctx), options),
            PUT: this.adapt((ctx) => apiView.dispatch(ctx), options),
            DELETE: this.adapt((ctx) => apiView.dispatch(ctx), options),
        };
    }

    /**
     * Build handlers for GenericAPIView-style collection/detail splits in catch-all routes.
     */
    adaptGenericAPIView(apiView: NextAPIView, options: AdaptNextViewSetOptions = {}): NextViewSetRouteHandlers {
        // Default catch-all param matches the Next.js [[...tango]] route convention.
        const paramKey = options.paramKey ?? 'tango';
        return {
            GET: this.adapt(async (ctx) => {
                const detailId = this.resolveDetailId(ctx.params, paramKey);
                if (!detailId) {
                    return apiView.dispatch(ctx);
                }
                ctx.params.id = detailId;
                return apiView.dispatch(ctx);
            }, options),
            POST: this.adapt(async (ctx) => {
                const detailId = this.resolveDetailId(ctx.params, paramKey);
                if (detailId) {
                    return this.methodNotAllowedResponse();
                }
                return apiView.dispatch(ctx);
            }, options),
            PATCH: this.adapt(async (ctx) => {
                const detailId = this.resolveDetailId(ctx.params, paramKey);
                if (!detailId) {
                    return this.methodNotAllowedResponse();
                }
                ctx.params.id = detailId;
                return apiView.dispatch(ctx);
            }, options),
            PUT: this.adapt(async (ctx) => {
                const detailId = this.resolveDetailId(ctx.params, paramKey);
                if (!detailId) {
                    return this.methodNotAllowedResponse();
                }
                ctx.params.id = detailId;
                return apiView.dispatch(ctx);
            }, options),
            DELETE: this.adapt(async (ctx) => {
                const detailId = this.resolveDetailId(ctx.params, paramKey);
                if (!detailId) {
                    return this.methodNotAllowedResponse();
                }
                ctx.params.id = detailId;
                return apiView.dispatch(ctx);
            }, options),
        };
    }

    private toTangoRequest(request: NextRequest): TangoRequest {
        if (TangoRequest.isTangoRequest(request)) {
            return request;
        }

        // oxlint-disable-next-line eslint-js/no-restricted-syntax
        if (request instanceof Request) {
            return new TangoRequest(request);
        }

        return new TangoRequest(String((request as { url?: unknown }).url ?? 'http://localhost'));
    }

    private dispatchViewSetAction(
        viewset: NextCrudViewSet,
        method: HttpMethod,
        ctx: RequestContext,
        paramKey: string,
        fallback: (segments: string[], directId: string | null) => TangoResponse | Promise<TangoResponse>
    ): Promise<TangoResponse> {
        const segments = this.extractCatchAllSegments(ctx.params, paramKey);
        const directId = this.extractDirectId(ctx.params);
        const actionMatch = this.resolveActionMatch(viewset, method, segments);

        if (actionMatch?.kind === InternalActionMatchKind.METHOD_NOT_ALLOWED) {
            return Promise.resolve(this.methodNotAllowedResponse());
        }
        if (actionMatch?.kind === InternalActionMatchKind.DETAIL) {
            return this.invokeDetailAction(viewset, actionMatch.action, ctx, actionMatch.id);
        }
        if (actionMatch?.kind === InternalActionMatchKind.COLLECTION) {
            return this.invokeCollectionAction(viewset, actionMatch.action, ctx);
        }

        return Promise.resolve(fallback(segments, directId));
    }

    private invokeDetailAction(
        viewset: NextCrudViewSet,
        action: ResolvedViewSetActionDescriptor,
        ctx: RequestContext,
        id: string
    ): Promise<TangoResponse> {
        const candidate = (viewset as unknown as Record<string, unknown>)[action.name];
        if (typeof candidate !== 'function') {
            return Promise.resolve(this.notFoundResponse());
        }
        return (candidate as (this: NextCrudViewSet, ctx: RequestContext, id: string) => Promise<TangoResponse>).call(
            viewset,
            ctx,
            id
        );
    }

    private invokeCollectionAction(
        viewset: NextCrudViewSet,
        action: ResolvedViewSetActionDescriptor,
        ctx: RequestContext
    ): Promise<TangoResponse> {
        const candidate = (viewset as unknown as Record<string, unknown>)[action.name];
        if (typeof candidate !== 'function') {
            return Promise.resolve(this.notFoundResponse());
        }
        return (candidate as (this: NextCrudViewSet, ctx: RequestContext) => Promise<TangoResponse>).call(viewset, ctx);
    }

    private createHandler(
        handler: (ctx: RequestContext, ...args: unknown[]) => Promise<TangoResponse>,
        options: AdaptNextOptions
    ): NextRouteHandler {
        return async (request: NextRequest, routeContext) => {
            try {
                const user = options.getUser ? await options.getUser(request) : null;
                const rawParams = routeContext?.params ? await routeContext.params : {};
                const params = this.normalizeRouteParams(rawParams);

                const ctx = RequestContext.create(this.toTangoRequest(request), user);
                if (Object.keys(params).length > 0) {
                    ctx.params = params;
                }

                const id = params?.id;
                if (id && handler.length > 1) {
                    return (await handler(ctx, id)).toWebResponse();
                }

                return (await handler(ctx)).toWebResponse();
            } catch (error) {
                return this.internalServerError(error);
            }
        };
    }

    private internalServerError(error: unknown): Response {
        this.logger.error('Adapter error:', error);
        const httpError = HttpErrorFactory.toHttpError(error);
        return TangoResponse.json(httpError.body as JsonValue, { status: httpError.status }).toWebResponse();
    }

    private adaptRouteHandlersFactory(factory: () => Promise<NextViewSetRouteHandlers>): NextViewSetRouteHandlers {
        let handlersPromise: Promise<NextViewSetRouteHandlers> | null = null;

        const getHandlers = async (): Promise<NextViewSetRouteHandlers> => {
            if (!handlersPromise) {
                const initializing = factory();
                handlersPromise = initializing.catch((error) => {
                    handlersPromise = null;
                    throw error;
                });
            }
            return handlersPromise;
        };

        const createLazyHandler = (method: keyof NextViewSetRouteHandlers): NextDynamicRouteHandler => {
            return async (request, context) => {
                try {
                    const handlers = await getHandlers();
                    return handlers[method](request, context);
                } catch (error) {
                    return this.internalServerError(error);
                }
            };
        };

        return {
            GET: createLazyHandler('GET'),
            POST: createLazyHandler('POST'),
            PATCH: createLazyHandler('PATCH'),
            PUT: createLazyHandler('PUT'),
            DELETE: createLazyHandler('DELETE'),
        };
    }

    private resolveDetailId(params: Record<string, string>, paramKey: string): string | null {
        const directId = this.extractDirectId(params);
        if (directId) {
            return directId;
        }
        const segments = this.extractCatchAllSegments(params, paramKey);
        if (segments.length !== 1) {
            return null;
        }
        return segments[0] as string;
    }

    private normalizeRouteParams(raw: Record<string, string | string[]>): Record<string, string> {
        const entries = Object.entries(raw).map(([key, value]) => {
            return [key, Array.isArray(value) ? value.join('/') : value];
        });

        return Object.fromEntries(entries);
    }

    private extractDirectId(params: Record<string, string>): string | null {
        const directId = params.id?.trim();
        return directId || null;
    }

    private extractCatchAllSegments(params: Record<string, string>, paramKey: string): string[] {
        const catchAll = params[paramKey]?.trim() ?? '';
        if (!catchAll) {
            return [];
        }
        return catchAll.split('/').filter(Boolean);
    }

    private methodNotAllowedResponse(): TangoResponse {
        return TangoResponse.json(
            {
                error: 'Method not allowed for this route.',
            },
            { status: 405 }
        );
    }

    private notFoundResponse(): TangoResponse {
        return TangoResponse.json(
            {
                error: 'Not found.',
            },
            { status: 404 }
        );
    }

    private resolveActionMatch(viewset: NextCrudViewSet, method: HttpMethod, segments: string[]): ActionMatch | null {
        if (segments.length === 0) {
            return null;
        }

        const actions = this.getViewSetActions(viewset);

        if (segments.length >= 2) {
            const detailPath = segments.slice(1).join('/');
            const detailMatch = actions.find(
                (action) => action.scope === InternalActionScope.DETAIL && action.path === detailPath
            );
            if (detailMatch) {
                return detailMatch.methods.includes(method)
                    ? { kind: InternalActionMatchKind.DETAIL, action: detailMatch, id: segments[0] as string }
                    : { kind: InternalActionMatchKind.METHOD_NOT_ALLOWED };
            }
        }

        if (method === InternalHttpMethod.GET && segments.length === 1) {
            return null;
        }

        const collectionPath = segments.join('/');
        const collectionMatch = actions.find(
            (action) => action.scope === InternalActionScope.COLLECTION && action.path === collectionPath
        );
        if (!collectionMatch) {
            return null;
        }
        return collectionMatch.methods.includes(method)
            ? { kind: InternalActionMatchKind.COLLECTION, action: collectionMatch }
            : { kind: InternalActionMatchKind.METHOD_NOT_ALLOWED };
    }

    private getViewSetActions(viewset: NextCrudViewSet): readonly ResolvedViewSetActionDescriptor[] {
        const constructorValue = viewset.constructor as {
            getActions?: (input: NextCrudViewSet) => readonly ResolvedViewSetActionDescriptor[];
        };

        if (typeof constructorValue.getActions !== 'function') {
            return [];
        }

        return constructorValue.getActions(viewset);
    }
}
