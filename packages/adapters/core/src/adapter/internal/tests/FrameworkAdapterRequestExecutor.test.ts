import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TangoResponse } from '@danceroutine/tango-core';
import { InternalFrameworkTransactionPolicy } from '../InternalFrameworkTransactionPolicy';
import {
    BoundFrameworkAdapterRequestExecutor,
    FrameworkAdapterRequestExecutor,
} from '../FrameworkAdapterRequestExecutor';

const atomicSpy = vi.hoisted(() => vi.fn(async (work: () => Promise<unknown>) => work()));

vi.mock('@danceroutine/tango-orm/transaction', () => ({
    atomic: atomicSpy,
}));

function streamFromText(text: string): ReadableStream<Uint8Array> {
    const encoded = new TextEncoder().encode(text);
    return new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(encoded);
            controller.close();
        },
    });
}

describe(FrameworkAdapterRequestExecutor, () => {
    beforeEach(() => {
        atomicSpy.mockClear();
    });

    describe(FrameworkAdapterRequestExecutor.prototype.runRequestTransaction, () => {
        it('wraps write methods when the writes-only transaction policy is enabled', async () => {
            const executor = new FrameworkAdapterRequestExecutor();
            const work = vi.fn(async () => 'done');

            await executor.runRequestTransaction('POST', InternalFrameworkTransactionPolicy.WRITES, work);
            await executor.runRequestTransaction('PUT', InternalFrameworkTransactionPolicy.WRITES, work);
            await executor.runRequestTransaction('PATCH', InternalFrameworkTransactionPolicy.WRITES, work);
            await executor.runRequestTransaction('DELETE', InternalFrameworkTransactionPolicy.WRITES, work);

            expect(atomicSpy).toHaveBeenCalledTimes(4);
            expect(work).toHaveBeenCalledTimes(4);
        });

        it('does not wrap read or metadata methods', async () => {
            const executor = new FrameworkAdapterRequestExecutor();
            const work = vi.fn(async () => 'done');

            await executor.runRequestTransaction('GET', InternalFrameworkTransactionPolicy.WRITES, work);
            await executor.runRequestTransaction('HEAD', InternalFrameworkTransactionPolicy.WRITES, work);
            await executor.runRequestTransaction('OPTIONS', InternalFrameworkTransactionPolicy.WRITES, work);

            expect(atomicSpy).not.toHaveBeenCalled();
            expect(work).toHaveBeenCalledTimes(3);
        });

        it('does not wrap requests when the method is missing', async () => {
            const executor = new FrameworkAdapterRequestExecutor();
            const work = vi.fn(async () => 'done');

            await executor.runRequestTransaction(undefined, InternalFrameworkTransactionPolicy.WRITES, work);

            expect(atomicSpy).not.toHaveBeenCalled();
            expect(work).toHaveBeenCalledTimes(1);
        });

        it('does not wrap requests when no transaction policy is configured', async () => {
            const executor = new FrameworkAdapterRequestExecutor();
            const work = vi.fn(async () => 'done');

            await executor.runRequestTransaction('POST', undefined, work);

            expect(atomicSpy).not.toHaveBeenCalled();
            expect(work).toHaveBeenCalledTimes(1);
        });
    });

    describe(FrameworkAdapterRequestExecutor.prototype.forHandler, () => {
        it('creates a bound request executor', () => {
            const executor = new FrameworkAdapterRequestExecutor();
            const boundExecutor = executor.forHandler({
                ctx: { requestId: 'req-1' },
                handler: async () => TangoResponse.text('ok'),
            });

            expect(boundExecutor).toBeInstanceOf(BoundFrameworkAdapterRequestExecutor);
        });
    });
});

describe(BoundFrameworkAdapterRequestExecutor, () => {
    describe(BoundFrameworkAdapterRequestExecutor.prototype.runResponse, () => {
        it('returns the Tango response produced by application code', async () => {
            const executor = new FrameworkAdapterRequestExecutor();
            const boundExecutor = executor.forHandler({
                ctx: { requestId: 'req-1' },
                handler: async () => TangoResponse.text('hello', { status: 202 }),
            });

            const response = await boundExecutor.runResponse('GET', undefined);
            const webResponse = response.toWebResponse();

            expect(webResponse.status).toBe(202);
            expect(webResponse.headers.get('content-type')).toContain('text/plain');
            expect(await webResponse.text()).toBe('hello');
        });

        it('preserves streaming responses without buffering them first', async () => {
            const executor = new FrameworkAdapterRequestExecutor();
            const boundExecutor = executor.forHandler({
                ctx: { requestId: 'req-1' },
                handler: async () => TangoResponse.stream(streamFromText('hello stream'), { status: 206 }),
            });

            const response = await boundExecutor.runResponse('GET', undefined);
            const webResponse = response.toWebResponse();

            expect(response.body).toBeInstanceOf(ReadableStream);
            expect(webResponse.status).toBe(206);
            expect(await webResponse.text()).toBe('hello stream');
        });

        it('returns empty responses without a body payload', async () => {
            const executor = new FrameworkAdapterRequestExecutor();
            const boundExecutor = executor.forHandler({
                ctx: { requestId: 'req-1' },
                handler: async () => new TangoResponse({ status: 204 }),
            });

            const response = await boundExecutor.runResponse('GET', undefined);
            const webResponse = response.toWebResponse();

            expect(webResponse.status).toBe(204);
            expect(webResponse.body).toBeNull();
        });

        it('passes the bound id to handlers that expect it', async () => {
            const executor = new FrameworkAdapterRequestExecutor();
            const handler = vi.fn(async (_ctx: { requestId: string }, id: string) =>
                TangoResponse.json({ id }, { status: 200 })
            );
            const boundExecutor = executor.forHandler({
                ctx: { requestId: 'req-1' },
                handler,
                id: 'post-42',
            });

            const response = await boundExecutor.runResponse('GET', undefined);
            const webResponse = response.toWebResponse();

            expect(handler).toHaveBeenCalledWith({ requestId: 'req-1' }, 'post-42');
            expect(await webResponse.text()).toContain('post-42');
        });

        it('omits the id when handlers only expect the request context', async () => {
            const executor = new FrameworkAdapterRequestExecutor();
            const handler = vi.fn(async (ctx: { requestId: string }) =>
                TangoResponse.json({ requestId: ctx.requestId }, { status: 200 })
            );
            const boundExecutor = executor.forHandler({
                ctx: { requestId: 'req-1' },
                handler,
                id: 'post-42',
            });

            const response = await boundExecutor.runResponse('GET', undefined);
            const webResponse = response.toWebResponse();

            expect(handler).toHaveBeenCalledWith({ requestId: 'req-1' });
            expect(await webResponse.text()).toContain('req-1');
        });
    });

    describe(BoundFrameworkAdapterRequestExecutor.prototype.runWebResponse, () => {
        it('converts Tango responses to native web responses after the handler runs', async () => {
            const executor = new FrameworkAdapterRequestExecutor();
            const boundExecutor = executor.forHandler({
                ctx: { requestId: 'req-1' },
                handler: async () => TangoResponse.text('native', { status: 203 }),
            });

            const response = await boundExecutor.runWebResponse('GET', undefined);

            expect(response.status).toBe(203);
            expect(await response.text()).toBe('native');
        });
    });
});
