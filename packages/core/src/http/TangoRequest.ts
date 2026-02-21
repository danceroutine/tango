import type { JsonValue } from './TangoBody';
import { TangoQueryParams } from './TangoQueryParams';
import {
    isArrayBuffer,
    isBlob,
    isFormData,
    isNil,
    isReadableStream,
    isUint8Array,
    isURLSearchParams,
} from '../runtime/index';

type TangoRequestInit = {
    method?: string;
    headers?: HeadersInit;
    body?: BodyInit | JsonValue | null;
    redirect?: RequestRedirect;
    cache?: RequestCache;
    credentials?: RequestCredentials;
    integrity?: string;
    keepalive?: boolean;
    mode?: RequestMode;
    referrer?: string;
    referrerPolicy?: ReferrerPolicy;
    signal?: AbortSignal;
};

/**
 * Framework request wrapper that normalizes JSON-like bodies and preserves
 * fetch `Request` compatibility for downstream handlers.
 */
export class TangoRequest implements Request {
    static readonly BRAND = 'tango.http.request' as const;
    readonly __tangoBrand: typeof TangoRequest.BRAND = TangoRequest.BRAND;
    private request: Request;
    private bodySourceValue: BodyInit | JsonValue | null;
    private queryParamsValue?: TangoQueryParams;

    constructor(input: string | Request, init: TangoRequestInit = {}) {
        const sourceRequest = typeof input === 'string' ? undefined : input;
        const method = (init.method ?? sourceRequest?.method ?? 'GET').toUpperCase();
        const headers = new Headers(init.headers ?? sourceRequest?.headers);
        const normalizedBody = this.normalizeBody(init.body, headers, method);

        const requestInit: RequestInit & { duplex?: 'half' } = {
            method,
            headers,
            redirect: init.redirect ?? sourceRequest?.redirect,
            cache: init.cache ?? sourceRequest?.cache,
            credentials: init.credentials ?? sourceRequest?.credentials,
            integrity: init.integrity ?? sourceRequest?.integrity,
            keepalive: init.keepalive ?? sourceRequest?.keepalive,
            mode: init.mode ?? sourceRequest?.mode,
            referrer: init.referrer ?? sourceRequest?.referrer,
            referrerPolicy: init.referrerPolicy ?? sourceRequest?.referrerPolicy,
            signal: init.signal ?? sourceRequest?.signal,
        };

        if (normalizedBody !== undefined) {
            requestInit.body = normalizedBody;
            if (isReadableStream(normalizedBody)) {
                requestInit.duplex = 'half';
            }
        }

        this.request = new Request(input, requestInit);
        this.bodySourceValue = normalizedBody ?? null;
    }

    /**
     * Narrow an unknown value to `TangoRequest`.
     */
    static isTangoRequest(value: unknown): value is TangoRequest {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === TangoRequest.BRAND
        );
    }

    /**
     * Expose the request cache mode from the underlying fetch request.
     */
    get cache(): RequestCache {
        return this.request.cache;
    }

    /**
     * Expose the request credentials mode from the underlying fetch request.
     */
    get credentials(): RequestCredentials {
        return this.request.credentials;
    }

    /**
     * Expose the request destination from the underlying fetch request.
     */
    get destination(): RequestDestination {
        return this.request.destination;
    }

    /**
     * Expose the request headers from the underlying fetch request.
     */
    get headers(): Headers {
        return this.request.headers;
    }

    /**
     * Expose the request integrity value from the underlying fetch request.
     */
    get integrity(): string {
        return this.request.integrity;
    }

    /**
     * Expose the request keepalive flag from the underlying fetch request.
     */
    get keepalive(): boolean {
        return this.request.keepalive;
    }

    /**
     * Expose the normalized HTTP method.
     */
    get method(): string {
        return this.request.method;
    }

    /**
     * Expose the request mode from the underlying fetch request.
     */
    get mode(): RequestMode {
        return this.request.mode;
    }

    /**
     * Expose the redirect policy from the underlying fetch request.
     */
    get redirect(): RequestRedirect {
        return this.request.redirect;
    }

    /**
     * Expose the referrer from the underlying fetch request.
     */
    get referrer(): string {
        return this.request.referrer;
    }

    /**
     * Expose the referrer policy from the underlying fetch request.
     */
    get referrerPolicy(): ReferrerPolicy {
        return this.request.referrerPolicy;
    }

    /**
     * Expose the abort signal from the underlying fetch request.
     */
    get signal(): AbortSignal {
        return this.request.signal;
    }

    /**
     * Expose the absolute request URL.
     */
    get url(): string {
        return this.request.url;
    }

    /**
     * Expose the readable request body stream when one exists.
     */
    get body(): Request['body'] {
        return this.request.body;
    }

    /**
     * Report whether the body has been consumed.
     */
    get bodyUsed(): boolean {
        return this.request.bodyUsed;
    }

    /**
     * Expose the pre-normalized body value used to build the request.
     */
    get bodySource(): BodyInit | JsonValue | null {
        return this.bodySourceValue;
    }

    /**
     * Expose normalized query parameters derived from the request URL.
     */
    get queryParams(): TangoQueryParams {
        this.queryParamsValue ??= TangoQueryParams.fromURL(this.request.url);
        return this.queryParamsValue;
    }

    /**
     * Read the request body as an array buffer.
     */
    async arrayBuffer(): Promise<ArrayBuffer> {
        return this.request.arrayBuffer();
    }

    /**
     * Read the request body as a blob.
     */
    async blob(): Promise<Blob> {
        return this.request.blob();
    }

    /**
     * Read the request body as bytes, including runtimes without `Request.bytes()`.
     */
    async bytes(): Promise<Uint8Array<ArrayBuffer>> {
        const requestWithBytes = this.request as Request & { bytes?: () => Promise<Uint8Array<ArrayBuffer>> };
        if (typeof requestWithBytes.bytes === 'function') {
            return requestWithBytes.bytes();
        }
        const buffer = await this.request.arrayBuffer();
        return new Uint8Array(buffer);
    }

    /**
     * Read the request body as form data.
     */
    async formData(): Promise<FormData> {
        return this.request.formData();
    }

    /**
     * Parse the request body as JSON.
     */
    async json<T = unknown>(): Promise<T> {
        return this.request.json() as Promise<T>;
    }

    /**
     * Read the request body as text.
     */
    async text(): Promise<string> {
        return this.request.text();
    }

    /**
     * Clone the request so downstream code can consume it independently.
     */
    clone(): TangoRequest {
        return new TangoRequest(this.request.clone());
    }

    private normalizeBody(
        body: BodyInit | JsonValue | null | undefined,
        headers: Headers,
        method: string
    ): BodyInit | undefined {
        if (method === 'GET' || method === 'HEAD') {
            return undefined;
        }
        if (isNil(body)) {
            return undefined;
        }
        if (typeof body === 'string') {
            return body;
        }
        if (isArrayBuffer(body) || isUint8Array(body) || isBlob(body)) {
            return body;
        }
        if (isURLSearchParams(body) || isFormData(body) || isReadableStream(body)) {
            return body as BodyInit;
        }

        const serialized = JSON.stringify(body);
        if (!headers.has('content-type')) {
            headers.set('content-type', 'application/json; charset=utf-8');
        }
        return serialized;
    }
}
