import { TangoError, type ErrorEnvelope, type ErrorDetails, type ProblemDetails } from '../errors/TangoError';
import {
    isArrayBuffer,
    isBlob,
    isFormData,
    isNil,
    isReadableStream,
    isUint8Array,
    isURLSearchParams,
} from '../runtime/index';
import { TangoHeaders } from '../http/TangoHeaders';
import { TangoBody, type JsonValue } from './TangoBody';

type TangoResponseInit = {
    body?: BodyInit | JsonValue | null;
    headers?: HeadersInit;
    ok?: boolean;
    redirected?: boolean;
    status?: number;
    statusText?: string;
    type?: ResponseType;
    url?: string;
};

/**
 * Framework response wrapper with fetch-compatible surface plus ergonomic helpers.
 */
export class TangoResponse implements Response {
    static readonly BRAND = 'tango.http.response' as const;
    readonly __tangoBrand: typeof TangoResponse.BRAND = TangoResponse.BRAND;
    readonly headers: TangoHeaders;
    readonly redirected: boolean;
    readonly status: number;
    readonly statusText: string;
    readonly type: ResponseType;
    readonly url: string;
    readonly body: Response['body'];
    private tangoBody: TangoBody;
    private okValue: boolean | undefined;

    constructor(init: TangoResponseInit = {}) {
        this.headers = new TangoHeaders(init.headers);
        this.redirected = Boolean(init.redirected);
        this.status = typeof init.status === 'number' ? init.status : 200;
        this.statusText = init.statusText || '';
        this.type = init.type || 'default';
        this.url = init.url || '';
        this.okValue = typeof init.ok === 'boolean' ? init.ok : undefined;

        this.tangoBody = new TangoBody(init.body ?? null, this.headers);
        this.body = isReadableStream(this.tangoBody.bodySource) ? this.tangoBody.bodySource : null;
    }

    /**
     * Narrow an unknown value to `TangoResponse`.
     */
    static isTangoResponse(value: unknown): value is TangoResponse {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === TangoResponse.BRAND
        );
    }

    /**
     * Create a JSON response with sensible content headers.
     */
    static json(
        data: JsonValue,
        init?: Omit<TangoResponseInit, 'body' | 'headers'> & { headers?: HeadersInit }
    ): TangoResponse {
        const headers = new TangoHeaders(init?.headers);
        if (!headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json; charset=utf-8');
        }
        const body = JSON.stringify(data);
        if (!headers.has('Content-Length')) {
            headers.set('Content-Length', new TextEncoder().encode(body).length.toString());
        }
        return new TangoResponse({
            ...init,
            body,
            headers,
        });
    }

    /**
     * Create a plain-text response with sensible content headers.
     */
    static text(
        text: string,
        init?: Omit<TangoResponseInit, 'body' | 'headers'> & { headers?: HeadersInit }
    ): TangoResponse {
        const headers = new TangoHeaders(init?.headers);
        if (!headers.has('Content-Type')) {
            headers.set('Content-Type', 'text/plain; charset=utf-8');
        }
        if (!headers.has('Content-Length')) {
            headers.set('Content-Length', new TextEncoder().encode(text).length.toString());
        }
        return new TangoResponse({
            ...init,
            body: text,
            headers,
        });
    }

    /**
     * Create an HTML response with sensible content headers.
     */
    static html(
        html: string,
        init?: Omit<TangoResponseInit, 'body' | 'headers'> & { headers?: HeadersInit }
    ): TangoResponse {
        const headers = new TangoHeaders(init?.headers);
        if (!headers.has('Content-Type')) {
            headers.set('Content-Type', 'text/html; charset=utf-8');
        }
        if (!headers.has('Content-Length')) {
            headers.set('Content-Length', new TextEncoder().encode(html).length.toString());
        }
        return new TangoResponse({
            ...init,
            body: html,
            headers,
        });
    }

    /**
     * Create a streaming response without buffering the payload in memory.
     */
    static stream(
        stream: ReadableStream<Uint8Array>,
        init?: Omit<TangoResponseInit, 'body' | 'headers'> & { headers?: HeadersInit }
    ): TangoResponse {
        return new TangoResponse({
            ...init,
            body: stream,
            headers: new TangoHeaders(init?.headers),
        });
    }

    /**
     * Create a redirect response and set the `Location` header.
     */
    static redirect(
        url: string,
        status: number = 302,
        init?: Omit<TangoResponseInit, 'body' | 'headers' | 'status'> & {
            headers?: HeadersInit;
        }
    ): TangoResponse {
        const headers = new TangoHeaders(init?.headers);
        headers.set('Location', url);
        return new TangoResponse({
            ...init,
            body: undefined,
            status,
            headers,
            redirected: true,
            url,
        });
    }

    /**
     * Create an empty `204 No Content` response.
     */
    static noContent(
        init?: Omit<TangoResponseInit, 'body' | 'status' | 'headers'> & {
            headers?: HeadersInit;
        }
    ): TangoResponse {
        const headers = new TangoHeaders(init?.headers);
        return new TangoResponse({
            ...init,
            body: undefined,
            status: 204,
            headers,
        });
    }

    /**
     * Create a `201 Created` response and optionally attach a location or body.
     */
    static created(
        location?: string,
        body?: JsonValue,
        init?: Omit<TangoResponseInit, 'body' | 'status' | 'headers'> & {
            headers?: HeadersInit;
        }
    ): TangoResponse {
        const headers = new TangoHeaders(init?.headers);
        if (location) {
            headers.set('Location', location);
        }
        let respBody: BodyInit | undefined;
        if (body !== undefined) {
            respBody = JSON.stringify(body);
            if (!headers.has('Content-Type')) {
                headers.set('Content-Type', 'application/json; charset=utf-8');
            }
        }
        if (typeof respBody === 'string' && !headers.has('Content-Length')) {
            headers.set('Content-Length', new TextEncoder().encode(respBody).length.toString());
        }
        return new TangoResponse({
            ...init,
            body: respBody,
            status: 201,
            headers,
        });
    }

    /**
     * Create a `405 Method Not Allowed` response and optionally populate `Allow`.
     */
    static methodNotAllowed(
        allow?: readonly string[],
        detail: string = 'Method not allowed.',
        init?: Omit<TangoResponseInit, 'body' | 'status' | 'headers'> & {
            headers?: HeadersInit;
        }
    ): TangoResponse {
        const headers = new TangoHeaders(init?.headers);
        if (allow && allow.length > 0) {
            headers.set('Allow', allow.join(', '));
        }
        return TangoResponse.json(
            {
                error: detail,
            },
            {
                ...init,
                status: 405,
                headers,
            }
        );
    }

    /**
     * Normalize a Tango error or problem-details object into an error response.
     */
    static error<TDetails extends ErrorDetails = null>(
        error: TangoError | ProblemDetails<TDetails>,
        init?: Omit<TangoResponseInit, 'body' | 'headers'> & { headers?: HeadersInit }
    ): TangoResponse {
        let code: string;
        let message: string;
        let details: ErrorDetails;
        let fields: Record<string, string[]> | undefined;
        let status = init?.status ?? 500;

        if (TangoError.isTangoError(error)) {
            const envelope = error.toErrorEnvelope();
            code = envelope.error.code;
            message = envelope.error.message;
            details = envelope.error.details;
            fields = envelope.error.fields;
            status = error.status;
        } else {
            code = error.code;
            message = error.message;
            details = error.details;
            fields = error.fields;
        }

        return TangoResponse.problem(
            {
                code,
                message,
                details,
                fields,
            },
            {
                ...init,
                status,
            }
        );
    }

    /**
     * Create a `400 Bad Request` response from a string or structured error.
     */
    static badRequest<TDetails extends ErrorDetails = null>(
        detail?: string | TangoError | ProblemDetails<TDetails>,
        init?: Omit<TangoResponseInit, 'body' | 'status' | 'headers'> & {
            headers?: HeadersInit;
        }
    ): TangoResponse {
        if (TangoError.isTangoError(detail) || TangoError.isProblemDetails(detail)) {
            return TangoResponse.error(detail, { ...init, status: 400 });
        }

        if (typeof detail === 'string') {
            return TangoResponse.error(
                {
                    code: 'bad_request',
                    message: detail,
                },
                { ...init, status: 400 }
            );
        }

        return TangoResponse.error(
            {
                code: 'bad_request',
                message: 'Bad Request',
            },
            { ...init, status: 400 }
        );
    }

    /**
     * Create a `401 Unauthorized` response from a string or structured error.
     */
    static unauthorized<TDetails extends ErrorDetails = null>(
        detail?: string | TangoError | ProblemDetails<TDetails>,
        init?: Omit<TangoResponseInit, 'body' | 'status' | 'headers'> & {
            headers?: HeadersInit;
        }
    ): TangoResponse {
        if (TangoError.isTangoError(detail) || TangoError.isProblemDetails(detail)) {
            return TangoResponse.error(detail, { ...init, status: 401 });
        }
        if (typeof detail === 'string') {
            return TangoResponse.error(
                {
                    code: 'unauthorized',
                    message: detail,
                },
                { ...init, status: 401 }
            );
        }

        return TangoResponse.error(
            {
                code: 'unauthorized',
                message: 'Unauthorized',
            },
            { ...init, status: 401 }
        );
    }

    /**
     * Create a `403 Forbidden` response from a string or structured error.
     */
    static forbidden<TDetails extends ErrorDetails = null>(
        detail?: string | TangoError | ProblemDetails<TDetails>,
        init?: Omit<TangoResponseInit, 'body' | 'status' | 'headers'> & {
            headers?: HeadersInit;
        }
    ): TangoResponse {
        if (TangoError.isTangoError(detail) || TangoError.isProblemDetails(detail)) {
            return TangoResponse.error(detail, { ...init, status: 403 });
        }

        if (typeof detail === 'string') {
            return TangoResponse.error(
                {
                    code: 'forbidden',
                    message: detail,
                },
                { ...init, status: 403 }
            );
        }

        return TangoResponse.error(
            {
                code: 'forbidden',
                message: 'Forbidden',
            },
            { ...init, status: 403 }
        );
    }

    /**
     * Create a `404 Not Found` response from a string or structured error.
     */
    static notFound<TDetails extends ErrorDetails = null>(
        detail?: string | TangoError | ProblemDetails<TDetails>,
        init?: Omit<TangoResponseInit, 'body' | 'status' | 'headers'> & {
            headers?: HeadersInit;
        }
    ): TangoResponse {
        if (TangoError.isTangoError(detail) || TangoError.isProblemDetails(detail)) {
            return TangoResponse.error(detail, { ...init, status: 404 });
        }

        if (typeof detail === 'string') {
            return TangoResponse.error(
                {
                    code: 'not_found',
                    message: detail,
                },
                { ...init, status: 404 }
            );
        }

        return TangoResponse.error(
            {
                code: 'not_found',
                message: 'Not Found',
            },
            { ...init, status: 404 }
        );
    }

    /**
     * Create a `409 Conflict` response from a string or structured error.
     */
    static conflict<TDetails extends ErrorDetails = null>(
        detail?: string | TangoError | ProblemDetails<TDetails>,
        init?: Omit<TangoResponseInit, 'body' | 'status' | 'headers'> & {
            headers?: HeadersInit;
        }
    ): TangoResponse {
        if (TangoError.isTangoError(detail) || TangoError.isProblemDetails(detail)) {
            return TangoResponse.error(detail, { ...init, status: 409 });
        }

        if (typeof detail === 'string') {
            return TangoResponse.error(
                {
                    code: 'conflict',
                    message: detail,
                },
                { ...init, status: 409 }
            );
        }

        return TangoResponse.error(
            {
                code: 'conflict',
                message: 'Conflict',
            },
            { ...init, status: 409 }
        );
    }

    /**
     * Create a `422 Unprocessable Entity` response from a string or structured error.
     */
    static unprocessableEntity<TDetails extends ErrorDetails = null>(
        detail?: string | TangoError | ProblemDetails<TDetails>,
        init?: Omit<TangoResponseInit, 'body' | 'status' | 'headers'> & {
            headers?: HeadersInit;
        }
    ): TangoResponse {
        if (TangoError.isTangoError(detail) || TangoError.isProblemDetails(detail)) {
            return TangoResponse.error(detail, { ...init, status: 422 });
        }

        if (typeof detail === 'string') {
            return TangoResponse.error(
                {
                    code: 'unprocessable_entity',
                    message: detail,
                },
                { ...init, status: 422 }
            );
        }

        return TangoResponse.error(
            {
                code: 'unprocessable_entity',
                message: 'Unprocessable Entity',
            },
            { ...init, status: 422 }
        );
    }

    /**
     * Create a `429 Too Many Requests` response from a string or structured error.
     */
    static tooManyRequests<TDetails extends ErrorDetails = null>(
        detail?: string | TangoError | ProblemDetails<TDetails>,
        init?: Omit<TangoResponseInit, 'body' | 'status' | 'headers'> & {
            headers?: HeadersInit;
        }
    ): TangoResponse {
        if (TangoError.isTangoError(detail) || TangoError.isProblemDetails(detail)) {
            return TangoResponse.error(detail, { ...init, status: 429 });
        }

        if (typeof detail === 'string') {
            return TangoResponse.error(
                {
                    code: 'too_many_requests',
                    message: detail,
                },
                { ...init, status: 429 }
            );
        }

        return TangoResponse.error(
            {
                code: 'too_many_requests',
                message: 'Too Many Requests',
            },
            { ...init, status: 429 }
        );
    }

    /**
     * Create a problem-details style error response with Tango's envelope shape.
     */
    static problem<TDetails extends ErrorDetails = null>(
        problem?: string | TangoError | ProblemDetails<TDetails> | unknown,
        init?: Omit<TangoResponseInit, 'body' | 'headers'> & {
            headers?: HeadersInit;
            status?: number;
        }
    ): TangoResponse {
        let status = init?.status ?? 500;
        const headers = new TangoHeaders(init?.headers);
        if (!headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/problem+json; charset=utf-8');
        }

        let code = 'error';
        let message = 'An error occurred';
        let details: ErrorDetails = undefined;
        let fields: Record<string, string[]> | undefined;

        if (TangoError.isTangoError(problem)) {
            const envelope = problem.toErrorEnvelope();
            status = problem.status;
            code = envelope.error.code;
            message = envelope.error.message;
            details = envelope.error.details;
            fields = envelope.error.fields;
        } else if (TangoError.isProblemDetails(problem)) {
            code = problem.code;
            message = problem.message;
            details = problem.details;
            fields = problem.fields;
        } else if (typeof problem === 'string') {
            message = problem;
        } else if (problem && typeof problem === 'object') {
            const extracted = problem as {
                details?: ErrorDetails;
                fields?: Record<string, string[]>;
            };
            details = extracted.details;
            fields = extracted.fields;
        }

        const envelope: ErrorEnvelope<ErrorDetails> = {
            error: {
                code,
                message,
                ...(details === undefined ? {} : { details }),
                ...(fields ? { fields } : {}),
            },
        };

        const body = JSON.stringify(envelope);
        if (!headers.has('Content-Length')) {
            headers.set('Content-Length', new TextEncoder().encode(body).length.toString());
        }
        return new TangoResponse({
            ...init,
            headers,
            status,
            body,
        });
    }

    /**
     * Returns a response for serving a file.
     */
    static file(
        file: Blob | Uint8Array | ArrayBuffer | ReadableStream<Uint8Array> | string,
        opts?: {
            filename?: string;
            contentType?: string;
            init?: Omit<TangoResponseInit, 'body' | 'headers'> & { headers?: HeadersInit };
        }
    ): TangoResponse {
        const headers = new TangoHeaders(opts?.init?.headers ?? {});
        if (opts?.filename) {
            // Serve as an attachment by default, but not 'download'
            headers.setContentDispositionInline(opts.filename);
        }
        if (opts?.contentType && !headers.has('Content-Type')) {
            headers.set('Content-Type', opts.contentType);
        } else if (!headers.has('Content-Type')) {
            headers.setContentTypeByFile(file, opts?.filename);
        }
        if (!headers.has('Content-Length')) {
            headers.setContentLengthFromBody(file);
        }
        return new TangoResponse({
            ...opts?.init,
            body: file as BodyInit,
            headers,
        });
    }

    /**
     * Returns a response that prompts the user to download the file.
     */
    static download(
        file: Blob | Uint8Array | ArrayBuffer | ReadableStream<Uint8Array> | string,
        opts?: {
            filename?: string;
            contentType?: string;
            init?: Omit<TangoResponseInit, 'body' | 'headers'> & { headers?: HeadersInit };
        }
    ): TangoResponse {
        const headers = new TangoHeaders(opts?.init?.headers ?? {});
        if (opts?.filename) {
            headers.setContentDispositionAttachment(opts.filename);
        } else {
            headers.set('Content-Disposition', 'attachment');
        }
        if (opts?.contentType && !headers.has('Content-Type')) {
            headers.set('Content-Type', opts.contentType);
        } else if (!headers.has('Content-Type')) {
            headers.setContentTypeByFile(file, opts?.filename);
        }
        if (!headers.has('Content-Length')) {
            headers.setContentLengthFromBody(file);
        }
        return new TangoResponse({
            ...opts?.init,
            body: file as BodyInit,
            headers,
        });
    }

    private static normalizeWebBody(body: BodyInit | JsonValue | null): BodyInit | null {
        if (
            isNil(body) ||
            typeof body === 'string' ||
            isBlob(body) ||
            isFormData(body) ||
            isArrayBuffer(body) ||
            isUint8Array(body) ||
            isURLSearchParams(body) ||
            isReadableStream(body)
        ) {
            return body;
        }

        return JSON.stringify(body);
    }

    /**
     * Expose the original body source for cloning and adapter integration.
     */
    get bodySource(): BodyInit | JsonValue | null {
        return this.tangoBody.bodySource;
    }

    /**
     * Report whether the status code falls inside the 2xx range.
     */
    get ok(): boolean {
        if (typeof this.okValue === 'boolean') return this.okValue;
        return this.status >= 200 && this.status < 300;
    }

    /**
     * Report whether the body has been consumed.
     */
    get bodyUsed(): boolean {
        return this.tangoBody.bodyUsed;
    }

    /**
     * Replace a header value on the response.
     */
    setHeader(name: string, value: string): void {
        this.headers.set(name, value);
    }
    /**
     * Append another value for a repeated response header.
     */
    appendHeader(name: string, value: string): void {
        this.headers.append(name, value);
    }
    /**
     * Read a response header value.
     */
    getHeader(name: string): string | null {
        return this.headers.get(name);
    }
    /**
     * Check whether a response header is present.
     */
    hasHeader(name: string): boolean {
        return this.headers.has(name);
    }
    /**
     * Remove a response header.
     */
    deleteHeader(name: string): void {
        this.headers.delete(name);
    }
    /**
     * Merge one or more values into the `Vary` header.
     */
    vary(...fields: string[]): void {
        this.headers.vary(...fields);
    }

    /**
     * Add a `Set-Cookie` header that replaces prior application intent.
     */
    setCookie(name: string, value: string, options?: Parameters<TangoHeaders['setCookie']>[2]): void {
        this.headers.setCookie(name, value, options);
    }
    /**
     * Append another `Set-Cookie` header.
     */
    appendCookie(name: string, value: string, options?: Parameters<TangoHeaders['appendCookie']>[2]): void {
        this.headers.appendCookie(name, value, options);
    }
    /**
     * Expire a cookie by issuing a matching deletion cookie header.
     */
    deleteCookie(name: string, options?: Parameters<TangoHeaders['deleteCookie']>[1]): void {
        this.headers.deleteCookie(name, options);
    }

    /**
     * Set the `Cache-Control` header through Tango's higher-level helper.
     */
    cacheControl(control: Parameters<TangoHeaders['cacheControl']>[0]): void {
        this.headers.cacheControl(control);
    }

    /**
     * Set the `Location` header on the response.
     */
    location(url: string): void {
        this.headers.location(url);
    }

    /**
     * Set the response content type.
     */
    contentType(mime: string): void {
        this.headers.contentType(mime);
    }

    // ---- Trace & Correlation helper methods ----

    /**
     * Set the X-Request-Id header (request correlation).
     * Returns this for fluent chaining.
     */
    withRequestId(requestId: string | undefined | null): this {
        if (!isNil(requestId) && typeof requestId === 'string' && requestId !== '') {
            this.headers.set('X-Request-Id', requestId);
        }
        return this;
    }

    /**
     * Set the traceparent header (W3C Trace Context propagation).
     * Returns this for fluent chaining.
     */
    withTraceparent(traceparent: string | undefined | null): this {
        if (!isNil(traceparent) && typeof traceparent === 'string' && traceparent !== '') {
            this.headers.set('traceparent', traceparent);
        }
        return this;
    }

    /**
     * Set the Server-Timing header.
     * Accepts a string or array of timing metrics.
     * Returns this for fluent chaining.
     */
    withServerTiming(timing: string | string[]): this {
        if (Array.isArray(timing)) {
            this.headers.set('Server-Timing', timing.join(', '));
        } else if (typeof timing === 'string') {
            this.headers.set('Server-Timing', timing);
        }
        return this;
    }

    /**
     * Set the X-Response-Time header (in ms).
     * Numeric or formatted string (e.g. "76ms").
     * Returns this for fluent chaining.
     */
    withResponseTime(time: number | string): this {
        if (typeof time === 'number') {
            this.headers.set('X-Response-Time', `${time}ms`);
        } else if (typeof time === 'string') {
            this.headers.set('X-Response-Time', time);
        }
        return this;
    }

    /**
     * Propagate common tracing/correlation headers from provided Headers, TangoHeaders, or plain object.
     * Known headers: x-request-id, traceparent, server-timing
     * Returns this for fluent chaining.
     */
    propagateTraceHeaders(input: HeadersInit): this {
        const incoming = new TangoHeaders(input);
        const traceHeaderNames = [
            'x-request-id',
            'traceparent',
            'server-timing',
            // If you want to propagate response time, add 'x-response-time',
        ];
        for (const name of traceHeaderNames) {
            const value = incoming.get(name);
            if (!isNil(value)) this.headers.set(name, value);
        }
        return this;
    }

    /**
     * Clone the response so its body can be consumed independently.
     */
    clone(): TangoResponse {
        if (this.bodyUsed) {
            throw new TypeError('Body has already been used');
        }
        const clonedBody = this.tangoBody.clone();
        return new TangoResponse({
            body: clonedBody.bodySource,
            headers: this.headers.clone(),
            ok: this.okValue,
            redirected: this.redirected,
            status: this.status,
            statusText: this.statusText,
            type: this.type,
            url: this.url,
        });
    }

    /**
     * Convert this Tango-owned response into a native web `Response`.
     *
     * Adapters use this at the host-framework boundary so Tango can standardize
     * on `TangoResponse` internally while Next.js and other hosts still receive
     * a platform-native response object.
     */
    toWebResponse(): Response {
        const responseForTransfer = !this.bodyUsed && isReadableStream(this.bodySource) ? this.clone() : this;
        const body = TangoResponse.normalizeWebBody(responseForTransfer.bodySource);

        return new Response(body, {
            headers: new Headers(responseForTransfer.headers),
            status: responseForTransfer.status,
            statusText: responseForTransfer.statusText,
        });
    }

    //---- Spec Response interface fields and methods ----

    /**
     * Read the response body as an array buffer.
     */
    async arrayBuffer(): Promise<ArrayBuffer> {
        return this.tangoBody.arrayBuffer();
    }
    /**
     * Read the response body as a blob.
     */
    async blob(): Promise<Blob> {
        return this.tangoBody.blob();
    }
    /**
     * Read the response body as bytes.
     */
    async bytes(): Promise<Uint8Array<ArrayBuffer>> {
        return this.tangoBody.bytes();
    }
    /**
     * Read the response body as form data.
     */
    async formData(): Promise<FormData> {
        return this.tangoBody.formData();
    }
    /**
     * Parse the response body as JSON.
     */
    async json<T = unknown>(): Promise<T> {
        return this.tangoBody.json<T>();
    }
    /**
     * Read the response body as text.
     */
    async text(): Promise<string> {
        return this.tangoBody.text();
    }

    /**
     * Returns a plain object debug representation of this response: { status, headers: { ... }, bodyType: ... }.
     * Intended for testing and debug tooling.
     */
    toJSON(): { status: number; headers: Record<string, string>; bodyType: string } {
        return {
            status: this.status,
            headers: Object.fromEntries(this.headers.entries()),
            bodyType: this.tangoBody.bodyType,
        };
    }

    /**
     * Returns the original body for test/debug purposes *without* consuming the stream.
     *
     * @throws {Error} if called in a production environment. Provided only for test or debug.
     * @remarks
     * This method gives direct access to the original body as provided to the constructor,
     * before consumption. It is primarily intended for use in test code, introspection, or
     * advanced debug tools. **Do not rely on this in production.**
     * In production (`process.env.NODE_ENV === 'production'`), using this method will throw.
     *
     * This method is _not_ part of the web Response interface, and is intentionally private/internal.
     */

    public __peekBodyForTestOnly(): BodyInit | JsonValue | null {
        const nodeEnv = typeof process !== 'undefined' ? (process.env?.NODE_ENV as string | undefined) : undefined;

        // Strong guard against accidental shipping in production
        if (nodeEnv === 'production' || nodeEnv === 'prod') {
            throw new Error('peekBody() is not available in production builds. For test/debug use only.');
        }
        return this.tangoBody.bodySource;
    }
}
