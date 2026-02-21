import { TangoResponse } from '@danceroutine/tango-core';
import { RequestContext } from '../context/index';

export type APIViewMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type APIViewMethodHandler = (ctx: RequestContext) => Promise<TangoResponse>;

/**
 * Lightweight class-based request dispatcher for non-model API endpoints.
 */
export abstract class APIView {
    static readonly BRAND = 'tango.resources.api_view' as const;
    readonly __tangoBrand: typeof APIView.BRAND = APIView.BRAND;

    /**
     * Narrow an unknown value to `APIView`.
     */
    static isAPIView(value: unknown): value is APIView {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === APIView.BRAND
        );
    }

    /**
     * Dispatch the request to the handler for the current HTTP method.
     */
    async dispatch(ctx: RequestContext): Promise<TangoResponse> {
        const method = normalizeMethod(ctx.request.method);
        if (!method) {
            return this.httpMethodNotAllowed();
        }

        const handler = this.getMethodHandler(method);
        return handler(ctx);
    }

    getAllowedMethods(): readonly APIViewMethod[] {
        const allowed: APIViewMethod[] = [];
        if (this.get !== APIView.prototype.get) {
            allowed.push('GET');
        }
        if (this.post !== APIView.prototype.post) {
            allowed.push('POST');
        }
        if (this.put !== APIView.prototype.put) {
            allowed.push('PUT');
        }
        if (this.patch !== APIView.prototype.patch) {
            allowed.push('PATCH');
        }
        if (this.delete !== APIView.prototype.delete) {
            allowed.push('DELETE');
        }
        return allowed;
    }

    protected get(_ctx: RequestContext): Promise<TangoResponse> {
        return Promise.resolve(this.httpMethodNotAllowed());
    }

    protected post(_ctx: RequestContext): Promise<TangoResponse> {
        return Promise.resolve(this.httpMethodNotAllowed());
    }

    protected put(_ctx: RequestContext): Promise<TangoResponse> {
        return Promise.resolve(this.httpMethodNotAllowed());
    }

    protected patch(_ctx: RequestContext): Promise<TangoResponse> {
        return Promise.resolve(this.httpMethodNotAllowed());
    }

    protected delete(_ctx: RequestContext): Promise<TangoResponse> {
        return Promise.resolve(this.httpMethodNotAllowed());
    }

    protected httpMethodNotAllowed(): TangoResponse {
        return TangoResponse.methodNotAllowed(this.getAllowedMethods());
    }

    private getMethodHandler(method: APIViewMethod): APIViewMethodHandler {
        if (method === 'GET') {
            return (ctx) => this.get(ctx);
        }
        if (method === 'POST') {
            return (ctx) => this.post(ctx);
        }
        if (method === 'PUT') {
            return (ctx) => this.put(ctx);
        }
        if (method === 'PATCH') {
            return (ctx) => this.patch(ctx);
        }
        return (ctx) => this.delete(ctx);
    }
}

function normalizeMethod(method: string): APIViewMethod | null {
    const upper = method.toUpperCase();
    if (upper === 'GET') {
        return 'GET';
    }
    if (upper === 'POST') {
        return 'POST';
    }
    if (upper === 'PUT') {
        return 'PUT';
    }
    if (upper === 'PATCH') {
        return 'PATCH';
    }
    if (upper === 'DELETE') {
        return 'DELETE';
    }
    return null;
}
