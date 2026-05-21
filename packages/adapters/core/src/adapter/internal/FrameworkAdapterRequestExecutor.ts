import { TangoResponse } from '@danceroutine/tango-core';
import { atomic } from '@danceroutine/tango-orm/transaction';
import { InternalHttpMethod } from '../../domain/internal/InternalHttpMethod';
import type { FrameworkTransactionPolicy } from './InternalFrameworkTransactionPolicy';
import { InternalFrameworkTransactionPolicy } from './InternalFrameworkTransactionPolicy';

const TRANSACTIONAL_HTTP_METHODS = new Set<string>([
    InternalHttpMethod.POST,
    InternalHttpMethod.PUT,
    InternalHttpMethod.PATCH,
    InternalHttpMethod.DELETE,
]);

type FrameworkHandler<TContext> =
    | ((ctx: TContext) => Promise<TangoResponse>)
    | ((ctx: TContext, id: string) => Promise<TangoResponse>);

type FrameworkHandlerInvocation<TContext> = {
    ctx: TContext;
    handler: FrameworkHandler<TContext>;
    id?: string;
};

/**
 * Shared request execution support for host adapters that decide whether a
 * request should run inside a transaction.
 */
export class FrameworkAdapterRequestExecutor {
    forHandler<TContext>(invocation: FrameworkHandlerInvocation<TContext>): BoundFrameworkAdapterRequestExecutor<TContext> {
        return new BoundFrameworkAdapterRequestExecutor(this, invocation);
    }

    async runRequestTransaction<T>(
        method: string | undefined,
        transaction: FrameworkTransactionPolicy | undefined,
        work: () => Promise<T>
    ): Promise<T> {
        if (transaction !== InternalFrameworkTransactionPolicy.WRITES) {
            return work();
        }

        const normalizedMethod = String(method ?? '').toUpperCase();
        if (!TRANSACTIONAL_HTTP_METHODS.has(normalizedMethod)) {
            return work();
        }

        return atomic(async () => work());
    }

    toWebResponse(response: TangoResponse): Response {
        return response.toWebResponse();
    }
}

/**
 * Request-scoped executor that binds one Tango handler invocation to the
 * shared request execution policy.
 */
export class BoundFrameworkAdapterRequestExecutor<TContext> {
    constructor(
        private readonly requestExecutor: FrameworkAdapterRequestExecutor,
        private readonly invocation: FrameworkHandlerInvocation<TContext>
    ) {}

    async runResponse(
        method: string | undefined,
        transaction: FrameworkTransactionPolicy | undefined
    ): Promise<TangoResponse> {
        return this.requestExecutor.runRequestTransaction(method, transaction, async () => this.invokeHandler());
    }

    async runWebResponse(method: string | undefined, transaction: FrameworkTransactionPolicy | undefined): Promise<Response> {
        const response = await this.runResponse(method, transaction);
        return this.requestExecutor.toWebResponse(response);
    }

    private async invokeHandler(): Promise<TangoResponse> {
        const { ctx, handler, id } = this.invocation;
        if (id && handler.length > 1) {
            return (handler as (ctx: TContext, id: string) => Promise<TangoResponse>)(ctx, id);
        }
        return (handler as (ctx: TContext) => Promise<TangoResponse>)(ctx);
    }
}
