import { isArrayBuffer, isBlob, isUint8Array } from '../runtime/index';

/**
 * TangoHeaders extends the Web Headers class, adding ergonomic helpers
 * for common HTTP header patterns, convenience features, and a consistent API for
 * setting, appending, and deleting headers and cookies. This is designed to be
 * used by TangoResponse and other Tango HTTP utilities.
 * Additionally, provides helpers for safely setting Content-Length based on a known body,
 * and setting Content-Disposition for inline or attachment filenames.
 *
 * Includes helpers for request tracing and correlation headers:
 *   - X-Request-Id
 *   - traceparent (W3C Trace Context)
 *   - Server-Timing
 *   - X-Response-Time
 */
export class TangoHeaders extends Headers {
    static readonly BRAND = 'tango.http.headers' as const;
    readonly __tangoBrand: typeof TangoHeaders.BRAND = TangoHeaders.BRAND;

    /**
     * Narrow an unknown value to `TangoHeaders`.
     */
    static isTangoHeaders(value: unknown): value is TangoHeaders {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === TangoHeaders.BRAND
        );
    }

    /**
     * Serialize a cookie for the Set-Cookie header line.
     */
    private static serializeCookie(
        name: string,
        value: string,
        options: {
            domain?: string;
            expires?: Date;
            httpOnly?: boolean;
            maxAge?: number;
            path?: string;
            sameSite?: 'Strict' | 'Lax' | 'None';
            secure?: boolean;
            priority?: 'Low' | 'Medium' | 'High';
            partitioned?: boolean;
        } = {}
    ): string {
        let cookie = encodeURIComponent(name) + '=' + encodeURIComponent(value ?? '');
        if (options.domain) cookie += `; Domain=${options.domain}`;
        if (options.path) cookie += `; Path=${options.path}`;
        else cookie += '; Path=/';
        if (options.expires) cookie += `; Expires=${options.expires.toUTCString()}`;
        if (typeof options.maxAge === 'number') cookie += `; Max-Age=${options.maxAge}`;
        if (options.secure) cookie += '; Secure';
        if (options.httpOnly) cookie += '; HttpOnly';
        if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
        if (options.priority) cookie += `; Priority=${options.priority}`;
        if (options.partitioned) cookie += '; Partitioned';
        return cookie;
    }

    private static hasNumberSize(value: unknown): value is { size: number } {
        return typeof value === 'object' && value !== null && typeof (value as { size?: unknown }).size === 'number';
    }

    private static hasNumberLength(value: unknown): value is { length: number } {
        return (
            typeof value === 'object' && value !== null && typeof (value as { length?: unknown }).length === 'number'
        );
    }

    private static isNodeBuffer(value: unknown): value is { length: number } {
        const maybeBuffer = Buffer as unknown as { isBuffer?: (input: unknown) => boolean };
        return (
            typeof Buffer !== 'undefined' && typeof maybeBuffer.isBuffer === 'function' && maybeBuffer.isBuffer(value)
        );
    }

    /**
     * Sets the Content-Disposition header with type "inline" and the specified filename.
     * This is useful to indicate that the content should be displayed inline in the browser,
     * but with a suggested filename for saving.
     *
     * @param filename The filename to include in the Content-Disposition header.
     */
    setContentDispositionInline(filename: string): void {
        const encoded = encodeURIComponent(filename);
        this.set('Content-Disposition', `inline; filename="${encoded}"; filename*=UTF-8''${encoded}`);
    }

    /**
     * Sets the Content-Disposition header with type "attachment" and the specified filename.
     * This is useful to indicate that the response should be downloaded as a file.
     *
     * @param filename The filename to include in the Content-Disposition header.
     */
    setContentDispositionAttachment(filename: string): void {
        const encoded = encodeURIComponent(filename);
        this.set('Content-Disposition', `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`);
    }

    /**
     * Create a copy that preserves all header names and values.
     */
    clone(): TangoHeaders {
        const copy = new TangoHeaders();
        for (const [name, value] of this.entries()) {
            copy.append(name, value);
        }
        return copy;
    }

    /**
     * Set a header, replacing the existing value.
     */
    setHeader(name: string, value: string): void {
        this.set(name, value);
    }

    /**
     * Append a header, adding to existing value(s) for the name.
     */
    appendHeader(name: string, value: string): void {
        this.append(name, value);
    }

    /**
     * Get a header value (first value if header is repeated).
     */
    getHeader(name: string): string | null {
        return this.get(name);
    }

    /**
     * Check if a header exists.
     */
    hasHeader(name: string): boolean {
        return this.has(name);
    }

    /**
     * Delete a header.
     */
    deleteHeader(name: string): void {
        this.delete(name);
    }

    /**
     * Ensure a header is present only once and fully replaces the old value.
     */
    ensureUnique(name: string, value: string): void {
        this.delete(name);
        this.set(name, value);
    }

    /**
     * Add a field (or fields) to the Vary header, merging with existing values.
     */
    vary(...fields: string[]): void {
        if (fields.length === 0) return;
        const key = 'Vary';
        const prev = this.get(key);
        const nextSet = new Set<string>();
        if (prev) {
            for (const v of prev.split(',')) {
                if (v.trim()) nextSet.add(v.trim());
            }
        }
        for (const f of fields) {
            if (f.trim()) nextSet.add(f.trim());
        }
        this.set(key, Array.from(nextSet).join(', '));
    }

    /**
     * Set a cookie header (for Set-Cookie).
     * @param name
     * @param value
     * @param options
     */
    setCookie(
        name: string,
        value: string,
        options?: {
            domain?: string;
            expires?: Date;
            httpOnly?: boolean;
            maxAge?: number;
            path?: string;
            sameSite?: 'Strict' | 'Lax' | 'None';
            secure?: boolean;
            priority?: 'Low' | 'Medium' | 'High';
            partitioned?: boolean;
        }
    ): void {
        this.append('Set-Cookie', TangoHeaders.serializeCookie(name, value, options));
    }

    /**
     * Append (additionally) a new cookie.
     */
    appendCookie(
        name: string,
        value: string,
        options?: {
            domain?: string;
            expires?: Date;
            httpOnly?: boolean;
            maxAge?: number;
            path?: string;
            sameSite?: 'Strict' | 'Lax' | 'None';
            secure?: boolean;
            priority?: 'Low' | 'Medium' | 'High';
            partitioned?: boolean;
        }
    ): void {
        this.append('Set-Cookie', TangoHeaders.serializeCookie(name, value, options));
    }

    /**
     * Delete a cookie ("unset" it via expired date).
     */
    deleteCookie(
        name: string,
        options?: {
            domain?: string;
            path?: string;
            sameSite?: 'Strict' | 'Lax' | 'None';
            secure?: boolean;
            priority?: 'Low' | 'Medium' | 'High';
            partitioned?: boolean;
        }
    ): void {
        this.setCookie(name, '', {
            ...options,
            expires: new Date(0),
            maxAge: 0,
        });
    }

    /**
     * Add or override Cache-Control header with helpers for common policies.
     */
    cacheControl(control: string | Record<string, string | number | boolean | undefined>): void {
        if (typeof control === 'string') {
            this.set('Cache-Control', control);
            return;
        }
        // Compose Cache-Control from object
        const parts: string[] = [];
        for (const [k, v] of Object.entries(control)) {
            if (typeof v === 'boolean') {
                if (v) parts.push(k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()));
            } else if (typeof v === 'number' || (typeof v === 'string' && v.length > 0)) {
                parts.push(`${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}=${v}`);
            }
        }
        if (parts.length) {
            this.set('Cache-Control', parts.join(', '));
        }
    }

    /**
     * Set the Location header.
     */
    location(url: string): void {
        this.set('Location', url);
    }

    /**
     * Set the Content-Type header.
     */
    contentType(mime: string): void {
        this.set('Content-Type', mime);
    }

    /**
     * Attempt to guess and set the Content-Type header from a file (string or Blob) and optional filename.
     *
     * @param file File-like input (string or Blob)
     * @param filename Optional filename to help guess mime type by extension
     */
    setContentTypeByFile(file: unknown, filename?: string): void {
        // do not overwrite explicit content-type
        if (this.has('Content-Type')) return;

        // If file is a string and a filename is provided or can be guessed from file path
        if (typeof file === 'string' && filename) {
            // Guess type by extension
            const dotIndex = filename.lastIndexOf('.');
            const ext = dotIndex >= 0 ? filename.slice(dotIndex + 1).toLowerCase() : '';
            const map: Record<string, string> = {
                txt: 'text/plain',
                text: 'text/plain',
                html: 'text/html',
                css: 'text/css',
                js: 'application/javascript',
                json: 'application/json',
                jpg: 'image/jpeg',
                jpeg: 'image/jpeg',
                png: 'image/png',
                gif: 'image/gif',
                webp: 'image/webp',
                pdf: 'application/pdf',
                svg: 'image/svg+xml',
                ico: 'image/x-icon',
                md: 'text/markdown',
            };
            const mime = map[ext];
            if (mime) {
                this.set('Content-Type', mime);
            } else {
                this.set('Content-Type', 'application/octet-stream');
            }
            return;
        }

        // If it's a Blob, use its type, or fallback
        if (isBlob(file)) {
            if (file.type && file.type !== '') {
                this.set('Content-Type', file.type);
            } else {
                this.set('Content-Type', 'application/octet-stream');
            }
            return;
        }

        // Fallback
        this.set('Content-Type', 'application/octet-stream');
    }

    /**
     * Sets the Content-Length header, inferring it from the body if not explicitly provided.
     * If the body is a string, ArrayBuffer, Uint8Array, Blob/Buffer (or has a .size or .length property),
     * the length is computed. For unsupported types, does nothing.
     * Mirrors logic from TangoResponse.ts, but generalized for use anywhere.
     */
    setContentLengthFromBody(body: unknown): void {
        if (this.has('Content-Length') || body === null || body === undefined) {
            return;
        }

        let len: number | undefined;

        if (typeof body === 'string') {
            len = new TextEncoder().encode(body).length;
        } else if (isArrayBuffer(body)) {
            len = body.byteLength;
        }
        // Node.js Buffer support (Buffer.isBuffer and .length)
        else if (TangoHeaders.isNodeBuffer(body)) {
            len = (body as { length: number }).length;
        } else if (isUint8Array(body)) {
            len = body.byteLength;
        } else if (isBlob(body)) {
            len = body.size;
        }
        // Generic "size" (number) property
        else if (TangoHeaders.hasNumberSize(body)) {
            len = (body as { size: number }).size;
        }
        // Generic "length" (number) property but not string/ArrayBuffer/Uint8Array/etc
        else if (
            TangoHeaders.hasNumberLength(body) &&
            typeof body !== 'string' &&
            !isArrayBuffer(body) &&
            !isUint8Array(body)
        ) {
            len = (body as { length: number }).length;
        }

        if (typeof len === 'number') {
            this.set('Content-Length', len.toString());
        }
    }

    /**
     * Set or update the X-Request-Id header. Used for associating a request/response with a unique id.
     * @param id The request id value to set.
     */
    withRequestId(id: string): this {
        this.set('X-Request-Id', id);
        return this;
    }

    /**
     * Set or update the traceparent header. Used for distributed trace context propagation (W3C Trace Context).
     * @param value The traceparent value (should be a valid traceparent header value).
     */
    withTraceParent(value: string): this {
        this.set('traceparent', value);
        return this;
    }

    /**
     * Set or append a value to the Server-Timing header.
     * For a single metric, supply name, and optionally dur and desc.
     * For advanced usage (many metrics), set the value directly or use appendServerTimingRaw.
     *
     * @param name Name of the server-timing metric (e.g., 'total', 'db').
     * @param dur Optional duration in ms.
     * @param desc Optional string description.
     */
    withServerTiming(name: string, dur?: number, desc?: string): this {
        // Build the metric string per spec: <metric>=<value>;dur=<duration>;desc="<description>"
        let metric = name;
        if (typeof dur === 'number') {
            metric += `;dur=${dur}`;
        }
        if (desc) {
            metric += `;desc="${desc.replace(/"/g, '\\"')}"`;
        }

        // Set or append. If header exists, append, separated by comma.
        const prev = this.get('Server-Timing');
        if (prev && prev.length > 0) {
            this.set('Server-Timing', prev + ', ' + metric);
        } else {
            this.set('Server-Timing', metric);
        }
        return this;
    }

    /**
     * Directly append a raw Server-Timing metric value.
     * This is useful for advanced cases where you have multiple metrics assembled.
     * @param value The server-timing value chunk to append.
     */
    appendServerTimingRaw(value: string): this {
        const prev = this.get('Server-Timing');
        if (prev && prev.length > 0) {
            this.set('Server-Timing', prev + ', ' + value);
        } else {
            this.set('Server-Timing', value);
        }
        return this;
    }

    /**
     * Set or update X-Response-Time header.
     * @param ms Elapsed time in milliseconds (number or string for flexibility).
     */
    withResponseTime(ms: number | string): this {
        this.set('X-Response-Time', typeof ms === 'number' ? `${ms}ms` : ms);
        return this;
    }

    /**
     * Return the current value of X-Request-Id.
     */
    getRequestId(): string | null {
        return this.get('X-Request-Id');
    }

    /**
     * Return the current value of traceparent header.
     */
    getTraceParent(): string | null {
        return this.get('traceparent');
    }

    /**
     * Return the current Server-Timing string, if set.
     */
    getServerTiming(): string | null {
        return this.get('Server-Timing');
    }

    /**
     * Return the current X-Response-Time string, if set.
     */
    getResponseTime(): string | null {
        return this.get('X-Response-Time');
    }
}
