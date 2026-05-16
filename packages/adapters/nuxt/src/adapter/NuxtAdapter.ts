import type { EventHandler, H3Event } from 'h3';
import { getRequestHeaders, getRequestURL, getRouterParams, readRawBody } from 'h3';
import { RequestContext } from '@danceroutine/tango-resources';
import {
    HttpErrorFactory,
    TangoQueryParams,
    TangoRequest,
    TangoResponse,
    getLogger,
    isURLSearchParams,
    type JsonValue,
} from '@danceroutine/tango-core';
import {
    FRAMEWORK_ADAPTER_BRAND,
    FrameworkAdapterRequestExecutor,
    type FrameworkAdapter,
    type FrameworkAdapterOptions,
} from '@danceroutine/tango-adapters-core/adapter';
import {
    InternalActionMatchKind,
    InternalActionScope,
    InternalHttpMethod,
    type ActionScope,
    type HttpMethod,
} from '@danceroutine/tango-adapters-core';
const SUPPORTED_HTTP_METHODS: readonly HttpMethod[] = [
    InternalHttpMethod.GET,
    InternalHttpMethod.POST,
    InternalHttpMethod.PATCH,
    InternalHttpMethod.PUT,
    InternalHttpMethod.DELETE,
];
const BODY_HTTP_METHODS = [
    InternalHttpMethod.POST,
    InternalHttpMethod.PATCH,
    InternalHttpMethod.PUT,
    InternalHttpMethod.DELETE,
] as const;

type ResolvedViewSetActionDescriptor = {
    name: string;
    scope: ActionScope;
    methods: readonly HttpMethod[];
    path: string;
};

type ActionMatch =
    | { kind: typeof InternalActionMatchKind.DETAIL; action: ResolvedViewSetActionDescriptor; id: string }
    | { kind: typeof InternalActionMatchKind.COLLECTION; action: ResolvedViewSetActionDescriptor }
    | { kind: typeof InternalActionMatchKind.METHOD_NOT_ALLOWED };

/**
 * Nitro event handler signature produced by the Nuxt adapter.
 */
export type NuxtEventHandler = EventHandler;

/**
 * Adapter options for Nuxt Nitro integration.
 */
export type AdaptNuxtOptions = FrameworkAdapterOptions<H3Event>;

/**
 * Minimal CRUD viewset contract used by the Nuxt adapter route helpers.
 */
export interface NuxtCrudViewSet {
    list(ctx: RequestContext): Promise<TangoResponse>;
    create(ctx: RequestContext): Promise<TangoResponse>;
    retrieve(ctx: RequestContext, id: string): Promise<TangoResponse>;
    update(ctx: RequestContext, id: string): Promise<TangoResponse>;
    destroy(ctx: RequestContext, id: string): Promise<TangoResponse>;
}

export interface NuxtAPIView {
    dispatch(ctx: RequestContext): Promise<TangoResponse>;
}

export type NuxtViewSetFactory = () => NuxtCrudViewSet | Promise<NuxtCrudViewSet>;
export type NuxtAPIViewFactory = () => NuxtAPIView | Promise<NuxtAPIView>;

/**
 * Options for catch-all Nuxt API route handlers.
 */
export type AdaptNuxtViewSetOptions = AdaptNuxtOptions & {
    paramKey?: string;
};

/**
 * Query record shape commonly produced by Nuxt route params.
 */
export type NuxtQueryRecord = Record<string, string | readonly (string | null | undefined)[] | null | undefined>;

/**
 * Normalize Nuxt route query inputs into Tango query params.
 */
export function toNuxtQueryParams(searchParams: URLSearchParams | NuxtQueryRecord): TangoQueryParams {
    if (isURLSearchParams(searchParams)) {
        return TangoQueryParams.fromURLSearchParams(searchParams);
    }

    const normalized: Record<string, string | string[] | undefined> = {};
    for (const [key, value] of Object.entries(searchParams)) {
        if (Array.isArray(value)) {
            const items = value.filter((item): item is string => typeof item === 'string');
            if (items.length > 0) {
                normalized[key] = items;
            }
            continue;
        }

        if (typeof value === 'string') {
            normalized[key] = value;
        }
    }

    return TangoQueryParams.fromRecord(normalized);
}

/**
 * Nuxt adapter that translates Nitro handlers to Tango `RequestContext`.
 */
export class NuxtAdapter implements FrameworkAdapter<Response, NuxtEventHandler, H3Event> {
    readonly __tangoBrand: typeof FRAMEWORK_ADAPTER_BRAND = FRAMEWORK_ADAPTER_BRAND;
    private readonly logger = getLogger('tango.adapter.nuxt');
    private readonly requestExecutor = new FrameworkAdapterRequestExecutor();

    /**
     * Normalize h3 query params into Tango query params.
     */
    toQueryParams(searchParams: URLSearchParams | NuxtQueryRecord): TangoQueryParams {
        return toNuxtQueryParams(searchParams);
    }

    /**
     * Adapt a Tango-style handler into a Nitro event handler.
     */
    adapt(
        handler: (ctx: RequestContext, ...args: unknown[]) => Promise<TangoResponse>,
        options: AdaptNuxtOptions = {}
    ): NuxtEventHandler {
        return this.createHandler(handler, options);
    }

    /**
     * Adapt a CRUD viewset into a single Nitro catch-all handler.
     */
    adaptViewSet(viewset: NuxtCrudViewSet, options: AdaptNuxtViewSetOptions = {}): NuxtEventHandler {
        const paramKey = options.paramKey ?? 'tango';
        return this.adapt((ctx) => {
            const method = this.resolveMethod(ctx.request.method);
            if (!method) {
                return Promise.resolve(this.methodNotAllowedResponse());
            }

            return this.dispatchViewSetAction(viewset, method, ctx, paramKey, (segments, directId) => {
                switch (method) {
                    case InternalHttpMethod.GET:
                        if (directId) return viewset.retrieve(ctx, directId);
                        if (segments.length === 0) return viewset.list(ctx);
                        if (segments.length === 1) return viewset.retrieve(ctx, segments[0] as string);
                        return this.notFoundResponse();
                    case InternalHttpMethod.POST:
                        return segments.length === 0 && !directId
                            ? viewset.create(ctx)
                            : this.methodNotAllowedResponse();
                    case InternalHttpMethod.PATCH:
                    case InternalHttpMethod.PUT: {
                        const id = directId ?? this.resolveFallbackDetailSegment(segments);
                        if (!id) {
                            return segments.length === 0 ? this.methodNotAllowedResponse() : this.notFoundResponse();
                        }
                        return viewset.update(ctx, id);
                    }
                    case InternalHttpMethod.DELETE: {
                        const id = directId ?? this.resolveFallbackDetailSegment(segments);
                        if (!id) {
                            return segments.length === 0 ? this.methodNotAllowedResponse() : this.notFoundResponse();
                        }
                        return viewset.destroy(ctx, id);
                    }
                }
            });
        }, options);
    }

    /**
     * Adapt a lazy viewset factory into a Nitro event handler with memoized initialization.
     */
    adaptViewSetFactory(factory: NuxtViewSetFactory, options: AdaptNuxtViewSetOptions = {}): NuxtEventHandler {
        return this.adaptHandlerFactory(async () => {
            const viewset = await factory();
            return this.adaptViewSet(viewset, options);
        });
    }

    /**
     * Adapt an APIView into a Nitro event handler.
     */
    adaptAPIView(apiView: NuxtAPIView, options: AdaptNuxtOptions = {}): NuxtEventHandler {
        return this.adapt((ctx) => apiView.dispatch(ctx), options);
    }

    /**
     * Adapt a GenericAPIView into a Nitro event handler for collection/detail routes.
     */
    adaptGenericAPIView(apiView: NuxtAPIView, options: AdaptNuxtViewSetOptions = {}): NuxtEventHandler {
        const paramKey = options.paramKey ?? 'tango';
        return this.adapt(async (ctx) => {
            const method = this.resolveMethod(ctx.request.method);
            if (!method) {
                return this.methodNotAllowedResponse();
            }
            const detailId = this.resolveDetailId(ctx.params, paramKey);

            switch (method) {
                case InternalHttpMethod.GET:
                    if (detailId) {
                        ctx.params.id = detailId;
                    }
                    return apiView.dispatch(ctx);
                case InternalHttpMethod.POST:
                    return detailId ? this.methodNotAllowedResponse() : apiView.dispatch(ctx);
                case InternalHttpMethod.PATCH:
                case InternalHttpMethod.PUT:
                case InternalHttpMethod.DELETE:
                    if (!detailId) {
                        return this.methodNotAllowedResponse();
                    }
                    ctx.params.id = detailId;
                    return apiView.dispatch(ctx);
            }
        }, options);
    }

    /**
     * Adapt a lazy GenericAPIView factory into a Nitro event handler with memoized initialization.
     */
    adaptGenericAPIViewFactory(factory: NuxtAPIViewFactory, options: AdaptNuxtViewSetOptions = {}): NuxtEventHandler {
        return this.adaptHandlerFactory(async () => {
            const apiView = await factory();
            return this.adaptGenericAPIView(apiView, options);
        });
    }

    private async toTangoRequest(event: H3Event): Promise<TangoRequest> {
        const url = getRequestURL(event, { xForwardedHost: true }).toString();
        const method = String(event.method || event.node.req.method || InternalHttpMethod.GET);
        const headers = new Headers(
            Object.entries(getRequestHeaders(event)).filter(
                (entry): entry is [string, string] => typeof entry[1] === 'string'
            )
        );
        const body = await this.normalizeBody(event, method);

        return new TangoRequest(url, {
            method,
            headers,
            body,
        });
    }

    private async normalizeBody(event: H3Event, method: string): Promise<BodyInit | null | undefined> {
        if (!BODY_HTTP_METHODS.includes(method.toUpperCase() as (typeof BODY_HTTP_METHODS)[number])) {
            return undefined;
        }

        const rawBody = await readRawBody(event, false);
        if (!rawBody || rawBody.length === 0) {
            return undefined;
        }

        return rawBody as BodyInit;
    }

    private resolveMethod(method: string | undefined): HttpMethod | null {
        const normalized = method?.toUpperCase();
        if (!normalized) {
            return null;
        }
        return SUPPORTED_HTTP_METHODS.includes(normalized as HttpMethod) ? (normalized as HttpMethod) : null;
    }

    private dispatchViewSetAction(
        viewset: NuxtCrudViewSet,
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
        viewset: NuxtCrudViewSet,
        action: ResolvedViewSetActionDescriptor,
        ctx: RequestContext,
        id: string
    ): Promise<TangoResponse> {
        const candidate = (viewset as unknown as Record<string, unknown>)[action.name];
        if (typeof candidate !== 'function') {
            return Promise.resolve(this.notFoundResponse());
        }
        return (candidate as (this: NuxtCrudViewSet, ctx: RequestContext, id: string) => Promise<TangoResponse>).call(
            viewset,
            ctx,
            id
        );
    }

    private invokeCollectionAction(
        viewset: NuxtCrudViewSet,
        action: ResolvedViewSetActionDescriptor,
        ctx: RequestContext
    ): Promise<TangoResponse> {
        const candidate = (viewset as unknown as Record<string, unknown>)[action.name];
        if (typeof candidate !== 'function') {
            return Promise.resolve(this.notFoundResponse());
        }
        return (candidate as (this: NuxtCrudViewSet, ctx: RequestContext) => Promise<TangoResponse>).call(viewset, ctx);
    }

    private createHandler(
        handler: (ctx: RequestContext, ...args: unknown[]) => Promise<TangoResponse>,
        options: AdaptNuxtOptions
    ): NuxtEventHandler {
        return async (event: H3Event): Promise<Response> => {
            try {
                const user = options.getUser ? await options.getUser(event) : null;
                const request = await this.toTangoRequest(event);
                const ctx = RequestContext.create(request, user);
                const params = this.normalizeRouteParams(getRouterParams(event));

                if (Object.keys(params).length > 0) {
                    ctx.params = params;
                }

                const id = params.id;
                const response = await this.requestExecutor
                    .forHandler({ handler, ctx, id })
                    .runMaterializedResponse(event.method, options.transaction);

                return new Response(response.body, {
                    headers: response.headers,
                    status: response.status,
                    statusText: response.statusText,
                });
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

    private adaptHandlerFactory(factory: () => Promise<NuxtEventHandler>): NuxtEventHandler {
        let handlerPromise: Promise<NuxtEventHandler> | null = null;

        const getHandler = async (): Promise<NuxtEventHandler> => {
            if (!handlerPromise) {
                const initializing = factory();
                handlerPromise = initializing.catch((error) => {
                    handlerPromise = null;
                    throw error;
                });
            }
            return handlerPromise;
        };

        return async (event: H3Event): Promise<Response> => {
            try {
                const handler = await getHandler();
                return await handler(event);
            } catch (error) {
                return this.internalServerError(error);
            }
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

    private normalizeRouteParams(raw: Record<string, string> = {}): Record<string, string> {
        return Object.fromEntries(Object.entries(raw));
    }

    private extractDirectId(params: Record<string, string>): string | null {
        const directId = params.id?.trim();
        return directId || null;
    }

    private resolveFallbackDetailSegment(segments: string[]): string | null {
        if (segments.length !== 1) {
            return null;
        }
        return segments[0] as string;
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

    private resolveActionMatch(viewset: NuxtCrudViewSet, method: HttpMethod, segments: string[]): ActionMatch | null {
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

    private getViewSetActions(viewset: NuxtCrudViewSet): readonly ResolvedViewSetActionDescriptor[] {
        const constructorValue = viewset.constructor as {
            getActions?: (input: NuxtCrudViewSet) => readonly ResolvedViewSetActionDescriptor[];
        };

        if (typeof constructorValue.getActions !== 'function') {
            return [];
        }

        return constructorValue.getActions(viewset);
    }
}
