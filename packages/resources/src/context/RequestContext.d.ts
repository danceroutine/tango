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
export declare class RequestContext<TUser = BaseUser> {
    static readonly BRAND: 'tango.resources.request_context';
    readonly request: Request;
    user: TUser | null;
    params: Record<string, string>;
    readonly __tangoBrand: typeof RequestContext.BRAND;
    private state;
    constructor(request: Request, user?: TUser | null, params?: Record<string, string>);
    /**
     * Narrow an unknown value to `RequestContext`.
     */
    static isRequestContext<TUser = BaseUser>(value: unknown): value is RequestContext<TUser>;
    /**
     * Construct a context with optional user payload.
     */
    static create<TUser = BaseUser>(request: Request, user?: TUser | null): RequestContext<TUser>;
    /**
     * Store arbitrary per-request state for downstream middleware/handlers.
     */
    setState<T>(key: string | symbol, value: T): void;
    /**
     * Retrieve previously stored request state.
     */
    getState<T>(key: string | symbol): T | undefined;
    /**
     * Check whether a state key has been set.
     */
    hasState(key: string | symbol): boolean;
    /**
     * Clone the context, including route params and request-local state.
     */
    clone(): RequestContext<TUser>;
}
