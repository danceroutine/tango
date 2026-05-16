import type { RequestContext, BaseUser } from '@danceroutine/tango-resources';
import type { FrameworkTransactionPolicy } from './internal/InternalFrameworkTransactionPolicy';
/**
 * Adapter interface for integrating Tango with a given framework.
 * @template TResponse - The response type.
 * @template THandlerType - The handler type.
 * @template TRequest - The request type.
 */
export interface FrameworkAdapter<TResponse = Response, THandlerType = unknown, TRequest = unknown> {
    adapt(
        handler: (ctx: RequestContext, ...args: unknown[]) => Promise<TResponse>,
        options?: FrameworkAdapterOptions<TRequest>
    ): THandlerType;
}

export const FRAMEWORK_ADAPTER_BRAND = 'tango.adapter.framework' as const;

/**
 * Options for the framework adapter.
 */
export interface FrameworkAdapterOptions<TRequest = unknown> {
    getUser?: (request: TRequest) => Promise<BaseUser | null> | BaseUser | null;
    transaction?: FrameworkTransactionPolicy;
}

type FrameworkAdapterShape = {
    __tangoBrand?: unknown;
    adapt?: unknown;
};

/**
 * Runtime guard for framework adapter instances using Tango branding.
 */
export function isFrameworkAdapter(value: unknown): value is FrameworkAdapter {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as FrameworkAdapterShape).adapt === 'function' &&
        (value as FrameworkAdapterShape).__tangoBrand === FRAMEWORK_ADAPTER_BRAND
    );
}
