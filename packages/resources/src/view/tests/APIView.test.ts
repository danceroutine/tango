import { describe, expect, it } from 'vitest';
import { TangoResponse } from '@danceroutine/tango-core';
import { aRequestContext } from '@danceroutine/tango-testing';
import { APIView } from '../APIView';
import { RequestContext } from '../../context/index';

class HealthView extends APIView {
    protected override async get(): Promise<TangoResponse> {
        return TangoResponse.json({ status: 'ok' });
    }
}

class UserActionView extends APIView {
    protected override async post(ctx: RequestContext): Promise<TangoResponse> {
        const body = (await ctx.request.json()) as { name: string };
        return TangoResponse.created(undefined, { created: body.name });
    }
}

class FullMethodView extends APIView {
    protected override async put(): Promise<TangoResponse> {
        return TangoResponse.text('put');
    }

    protected override async patch(): Promise<TangoResponse> {
        return TangoResponse.text('patch');
    }

    protected override async delete(): Promise<TangoResponse> {
        return TangoResponse.text('delete');
    }
}

class EmptyAPIView extends APIView {}

function aResourcesRequestContext(method: string, url: string, body?: unknown): RequestContext;
function aResourcesRequestContext(options?: {
    method?: string;
    url?: string;
    body?: unknown;
    params?: Record<string, string>;
}): RequestContext;
function aResourcesRequestContext(
    optionsOrMethod:
        | {
              method?: string;
              url?: string;
              body?: unknown;
              params?: Record<string, string>;
          }
        | string = {},
    urlArg?: string,
    bodyArg?: unknown
): RequestContext {
    if (typeof optionsOrMethod === 'string') {
        return aRequestContext({
            method: optionsOrMethod,
            url: urlArg,
            body: bodyArg,
            contextFactory: RequestContext.create,
        });
    }

    return aRequestContext({
        ...optionsOrMethod,
        contextFactory: RequestContext.create,
    });
}

describe(APIView, () => {
    it('dispatches implemented methods', async () => {
        const view = new HealthView();
        const response = await view.dispatch(
            aResourcesRequestContext({ method: 'GET', url: 'https://example.test/health' })
        );
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toEqual({ status: 'ok' });
    });

    it('returns 405 with allow header for unsupported methods', async () => {
        const view = new HealthView();
        const response = await view.dispatch(
            aResourcesRequestContext({ method: 'POST', url: 'https://example.test/health' })
        );
        const payload = await response.json();

        expect(response.status).toBe(405);
        expect(payload).toEqual({ error: 'Method not allowed.' });
        expect(response.headers.get('allow')).toBe('GET');
    });

    it('computes Allow from POST override', async () => {
        const view = new UserActionView();
        const response = await view.dispatch(
            aResourcesRequestContext({ method: 'GET', url: 'https://example.test/users' })
        );
        expect(response.headers.get('allow')).toBe('POST');
    });

    it('supports request-body handlers', async () => {
        const view = new UserActionView();
        const response = await view.dispatch(
            aResourcesRequestContext({
                method: 'POST',
                url: 'https://example.test/users',
                body: { name: 'pedro' },
            })
        );
        const payload = await response.json();

        expect(response.status).toBe(201);
        expect(payload).toEqual({ created: 'pedro' });
    });

    it('identifies API view instances', () => {
        const view = new HealthView();
        expect(APIView.isAPIView(view)).toBe(true);
        expect(APIView.isAPIView({})).toBe(false);
    });

    it('dispatches PUT, PATCH, and DELETE methods', async () => {
        const view = new FullMethodView();
        const put = await view.dispatch(
            aResourcesRequestContext({ method: 'PUT', url: 'https://example.test/items/1' })
        );
        const patch = await view.dispatch(
            aResourcesRequestContext({ method: 'PATCH', url: 'https://example.test/items/1' })
        );
        const del = await view.dispatch(
            aResourcesRequestContext({ method: 'DELETE', url: 'https://example.test/items/1' })
        );

        expect(await put.text()).toBe('put');
        expect(await patch.text()).toBe('patch');
        expect(await del.text()).toBe('delete');
    });

    it('computes Allow from PUT/PATCH/DELETE overrides', async () => {
        const view = new FullMethodView();
        const response = await view.dispatch(
            aResourcesRequestContext({ method: 'GET', url: 'https://example.test/items/1' })
        );
        expect(response.headers.get('allow')).toBe('PUT, PATCH, DELETE');
    });

    it('exposes allowed methods for OpenAPI consumers', () => {
        const view = new FullMethodView();
        expect(view.getAllowedMethods()).toEqual(['PUT', 'PATCH', 'DELETE']);
    });

    it('returns 405 for unknown methods', async () => {
        const view = new HealthView();
        const response = await view.dispatch(
            aResourcesRequestContext({ method: 'OPTIONS', url: 'https://example.test/health' })
        );
        expect(response.status).toBe(405);
    });

    it('uses default 405 handlers for all methods when no overrides exist', async () => {
        const view = new EmptyAPIView();

        const get = await view.dispatch(aResourcesRequestContext({ method: 'GET', url: 'https://example.test/empty' }));
        const post = await view.dispatch(
            aResourcesRequestContext({ method: 'POST', url: 'https://example.test/empty' })
        );
        const put = await view.dispatch(aResourcesRequestContext({ method: 'PUT', url: 'https://example.test/empty' }));
        const patch = await view.dispatch(
            aResourcesRequestContext({ method: 'PATCH', url: 'https://example.test/empty' })
        );
        const del = await view.dispatch(
            aResourcesRequestContext({ method: 'DELETE', url: 'https://example.test/empty' })
        );

        expect(get.status).toBe(405);
        expect(post.status).toBe(405);
        expect(put.status).toBe(405);
        expect(patch.status).toBe(405);
        expect(del.status).toBe(405);
    });
});
