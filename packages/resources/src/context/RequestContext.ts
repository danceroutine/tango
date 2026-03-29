import { TangoRequest } from '@danceroutine/tango-core';

/**
 * Default user shape for RequestContext.
 * Consumers can provide their own user type via the TUser generic parameter.
 */
export interface BaseUser {
    id: string | number;
    roles?: string[];
}

/**
 * Normalized request context passed through the framework adapter into viewset methods.
 * Generic over the user type so consumers can plug in their own auth infrastructure.
 */
export class RequestContext<TUser = BaseUser> {
    static readonly BRAND = 'tango.resources.request_context' as const;
    readonly __tangoBrand: typeof RequestContext.BRAND = RequestContext.BRAND;
    private state: Map<string | symbol, unknown> = new Map();

    constructor(
        public readonly request: TangoRequest,
        public user: TUser | null = null,
        public params: Record<string, string> = {}
    ) {}

    /**
     * Narrow an unknown value to `RequestContext`.
     */
    static isRequestContext<TUser = BaseUser>(value: unknown): value is RequestContext<TUser> {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === RequestContext.BRAND
        );
    }

    /**
     * Construct a context with optional user payload.
     */
    static create<TUser = BaseUser>(request: Request, user?: TUser | null): RequestContext<TUser> {
        return new RequestContext<TUser>(
            TangoRequest.isTangoRequest(request) ? request : new TangoRequest(request),
            user ?? null
        );
    }

    /**
     * Store arbitrary per-request state for downstream middleware/handlers.
     */
    setState<T>(key: string | symbol, value: T): void {
        this.state.set(key, value);
    }

    /**
     * Retrieve previously stored request state.
     */
    getState<T>(key: string | symbol): T | undefined {
        return this.state.get(key) as T | undefined;
    }

    /**
     * Check whether a state key has been set.
     */
    hasState(key: string | symbol): boolean {
        return this.state.has(key);
    }

    /**
     * Clone the context, including route params and request-local state.
     */
    clone(): RequestContext<TUser> {
        const cloned = new RequestContext<TUser>(this.request, this.user, { ...this.params });
        cloned.state = new Map(this.state);
        return cloned;
    }
}
