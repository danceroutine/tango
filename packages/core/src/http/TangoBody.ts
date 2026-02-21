import {
    isArrayBuffer,
    isBlob,
    isFile,
    isFormData,
    isNil,
    isReadableStream,
    isUint8Array,
    isURLSearchParams,
} from '../runtime/index';

/**
 * The full type of body that TangoResponse/TangoBody supports.
 * Unlike the fetch spec BodyInit, this can be directly:
 * - a string, ArrayBuffer, Uint8Array, Blob, FormData, ReadableStream, or JSON-like object, or null/undefined.
 */

type HeadersLike = { get?: (arg: string) => string | null };

type TangoBodySource = BodyInit | JsonValue | null;

/** Recursive JSON value contract used by Tango HTTP helpers. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * Unified body reader/clone utility for Tango request/response wrappers.
 */
export class TangoBody {
    static readonly BRAND = 'tango.http.body' as const;
    readonly __tangoBrand: typeof TangoBody.BRAND = TangoBody.BRAND;
    private bodySourceInternal: TangoBodySource;
    private bodyUsedInternal: boolean;
    private headers?: HeadersLike;

    constructor(bodySource: TangoBodySource, headers?: HeadersLike) {
        this.bodySourceInternal = bodySource;
        this.bodyUsedInternal = false;
        this.headers = headers;
    }

    /**
     * Narrow an unknown value to `TangoBody`.
     */
    static isTangoBody(value: unknown): value is TangoBody {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === TangoBody.BRAND
        );
    }

    /**
     * Expose the original body source for cloning and adapter integration.
     */
    public get bodySource(): TangoBodySource {
        return this.bodySourceInternal;
    }

    /**
     * Report whether a reader method has already consumed this body.
     */
    get bodyUsed(): boolean {
        return this.bodyUsedInternal;
    }

    /**
     * Describe the current body shape in a way that is useful for diagnostics.
     */
    get bodyType(): string {
        const body = this.bodySourceInternal;
        if (isNil(body)) return 'null';
        if (typeof body === 'string') return 'string';
        if (isArrayBuffer(body)) return 'ArrayBuffer';
        if (isUint8Array(body)) return 'Uint8Array';
        if (isBlob(body)) return 'Blob';
        if (isFormData(body)) return 'FormData';
        if (isURLSearchParams(body)) return 'URLSearchParams';
        if (isReadableStream(body)) return 'ReadableStream';
        if (TangoBody.isJsonValue(body)) return 'JsonValue';
        return typeof body;
    }

    /**
     * Returns true if value is a valid JSON value (recursively).
     */
    public static isJsonValue(v: unknown): v is JsonValue {
        if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
            return true;
        }
        if (Array.isArray(v)) {
            return v.every(TangoBody.isJsonValue);
        }
        if (typeof v === 'object' && v !== null && Object.prototype.toString.call(v) === '[object Object]') {
            return Object.values(v).every(TangoBody.isJsonValue);
        }
        return false;
    }

    /**
     * Deep clone utility for body values. Preserves types and values as in the legacy implementation.
     * If the source is a stream, the stream will be cloned if readable, otherwise throws.
     */
    static deepCloneBody(body: TangoBodySource): TangoBodySource {
        if (isNil(body)) {
            return null;
        }
        if (typeof body === 'string') {
            return body;
        }
        if (isArrayBuffer(body)) {
            return body.slice(0);
        }
        if (isUint8Array(body)) {
            return new Uint8Array(body);
        }
        if (isBlob(body)) {
            return body.slice(0, body.size, body.type);
        }
        if (isFormData(body)) {
            // Deep clone FormData: only text fields (files not handled)
            // This is the best we can do in cross-platform without File support.
            const cloned = new FormData();
            for (const [k, v] of body) {
                // If value is File, attempt to clone (not fully implemented)
                if (isFile(v)) {
                    // Note: Cloning File loses prototype, but rarely needed
                    const file = new File([v], v.name, { type: v.type, lastModified: v.lastModified });
                    cloned.append(k, file);
                } else {
                    cloned.append(k, v as string);
                }
            }
            return cloned;
        }
        if (isReadableStream(body)) {
            throw new TypeError('Cannot deep clone a ReadableStream directly; use TangoBody.clone()');
        }
        if (TangoBody.isJsonValue(body)) {
            return JSON.parse(JSON.stringify(body));
        }
        return null;
    }

    /**
     * Read a `ReadableStream` into an `ArrayBuffer`.
     */
    static async readStreamToArrayBuffer(stream: ReadableStream<Uint8Array>): Promise<ArrayBuffer> {
        const chunks: Uint8Array[] = [];
        const reader = stream.getReader();
        let total = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            total += value.length;
        }
        const joined = new Uint8Array(total);
        let off = 0;
        for (const chunk of chunks) {
            joined.set(chunk, off);
            off += chunk.length;
        }
        return joined.buffer.slice(0, joined.byteLength) as ArrayBuffer;
    }

    /**
     * Read a `ReadableStream` into a `Uint8Array`.
     */
    static async readStreamToUint8Array(stream: ReadableStream<Uint8Array>): Promise<Uint8Array<ArrayBuffer>> {
        const buf = await TangoBody.readStreamToArrayBuffer(stream);
        return new Uint8Array(buf) as Uint8Array<ArrayBuffer>;
    }

    /**
     * Read a `ReadableStream` into UTF-8 text.
     */
    static async readStreamToText(stream: ReadableStream<Uint8Array>): Promise<string> {
        const arr = await TangoBody.readStreamToUint8Array(stream);
        return new TextDecoder().decode(arr);
    }

    /**
     * Determine the content type for this body, if possible.
     * Respects an explicitly passed header, otherwise infers from value type.
     */
    static detectContentType(body: TangoBodySource, providedType?: string): string | undefined {
        if (providedType) return providedType;
        if (isNil(body)) return undefined;
        if (typeof body === 'string') return 'text/plain; charset=utf-8';
        if (isArrayBuffer(body) || isUint8Array(body)) return 'application/octet-stream';
        if (isBlob(body)) {
            if (body.type) return body.type;
            return 'application/octet-stream';
        }
        if (isFormData(body)) return undefined;
        if (typeof body === 'object' && TangoBody.isJsonValue(body)) return 'application/json; charset=utf-8';
        if (isReadableStream(body)) return undefined;
        return undefined;
    }

    /**
     * Attempt to determine the content length, in bytes, for this body.
     * Only available for certain body types, otherwise returns undefined.
     */
    static async getContentLength(body: TangoBodySource): Promise<number | undefined> {
        if (isNil(body)) return 0;
        if (typeof body === 'string') return new TextEncoder().encode(body).length;
        if (isUint8Array(body)) return body.byteLength;
        if (isArrayBuffer(body)) return body.byteLength;
        if (isBlob(body)) return body.size;
        if (TangoBody.isJsonValue(body)) return new TextEncoder().encode(JSON.stringify(body)).length;
        return undefined;
    }

    /**
     * Reads the body as an ArrayBuffer.
     */
    async arrayBuffer(): Promise<ArrayBuffer> {
        return this.consumeBody(async (input) => {
            if (isArrayBuffer(input)) return input;
            if (isUint8Array(input)) {
                const copy = new Uint8Array(input.byteLength);
                copy.set(input);
                return copy.buffer;
            }
            if (typeof input === 'string') return new TextEncoder().encode(input).buffer as ArrayBuffer;
            if (isBlob(input)) return input.arrayBuffer();
            if (isReadableStream(input)) {
                return TangoBody.readStreamToArrayBuffer(input);
            }
            if (TangoBody.isJsonValue(input)) {
                // If body is object/array, encode as JSON and return buffer
                return new TextEncoder().encode(JSON.stringify(input)).buffer as ArrayBuffer;
            }
            throw new TypeError('Body is not an ArrayBuffer, Blob, string, stream, or JSON serializable object');
        });
    }

    /**
     * Reads the body as a Blob (browser only).
     */
    async blob(): Promise<Blob> {
        return this.consumeBody(async (input) => {
            if (isBlob(input)) return input;
            if (typeof input === 'string') return new Blob([input]);
            if (isArrayBuffer(input)) return new Blob([input]);
            if (isUint8Array(input)) return new Blob([new Uint8Array(input)]);
            if (isReadableStream(input)) {
                const buf = await TangoBody.readStreamToArrayBuffer(input);
                return new Blob([buf]);
            }
            if (TangoBody.isJsonValue(input)) {
                return new Blob([JSON.stringify(input)], { type: 'application/json' });
            }
            throw new TypeError(
                'Body is not a Blob, string, ArrayBuffer, Uint8Array, stream, or JSON serializable object'
            );
        });
    }

    /**
     * Reads the body as a Uint8Array.
     */
    async bytes(): Promise<Uint8Array<ArrayBuffer>> {
        return this.consumeBody(async (input) => {
            if (isUint8Array(input)) return new Uint8Array(input);
            if (isArrayBuffer(input)) return new Uint8Array(input);
            if (typeof input === 'string') return new TextEncoder().encode(input);
            if (isBlob(input)) return new Uint8Array(await input.arrayBuffer());
            if (isReadableStream(input)) {
                return TangoBody.readStreamToUint8Array(input);
            }
            if (TangoBody.isJsonValue(input)) {
                return new TextEncoder().encode(JSON.stringify(input));
            }
            throw new TypeError('Body is not bytes, ArrayBuffer, Blob, string, stream, or JSON serializable object');
        });
    }

    /**
     * Reads the body as FormData.
     * Accepts FormData, or if type is urlencoded or multipart parses a string/bytes.
     */
    async formData(): Promise<FormData> {
        return this.consumeBody(async (input) => {
            if (isFormData(input)) return input;

            let contentType: string | undefined = undefined;
            if (this.headers && typeof this.headers.get === 'function') {
                const raw = this.headers.get('Content-Type');
                if (typeof raw === 'string') contentType = raw.toLowerCase();
            }

            let raw: string;
            if (typeof input === 'string') {
                raw = input;
            } else if (isArrayBuffer(input)) {
                raw = new TextDecoder().decode(input);
            } else if (isUint8Array(input)) {
                raw = new TextDecoder().decode(input);
            } else {
                throw new TypeError('Body is not valid for FormData');
            }

            // application/x-www-form-urlencoded
            if (contentType && contentType.includes('application/x-www-form-urlencoded')) {
                const form = new FormData();
                const params = new URLSearchParams(raw);
                params.forEach((value, key) => form.append(key, value));
                return form;
            }
            // multipart/form-data
            if (contentType && contentType.startsWith('multipart/form-data')) {
                const boundaryMatch = /boundary=([^\s;]+)/i.exec(contentType);
                if (!boundaryMatch) throw new TypeError('Missing boundary in multipart/form-data');
                const boundary = boundaryMatch[1];

                // Warning: minimal multipart parsing, no file support
                const parts = raw.split(`--${boundary}`);
                const form = new FormData();
                for (const part of parts) {
                    const trimmed = part.trim();
                    if (!trimmed || trimmed === '--' || trimmed === '') continue;

                    const [rawHeaders = '', ...rawBodyParts] = trimmed.split(/\r?\n\r?\n/);
                    const body = rawBodyParts.join('\n\n').replace(/\r?\n$/, '');
                    const dispositionMatch = /Content-Disposition:\s*form-data;\s*name="([^"]+)"/i.exec(rawHeaders);
                    if (!dispositionMatch) continue;
                    const name = dispositionMatch[1]!;
                    form.append(name, body);
                }
                return form;
            }
            throw new TypeError('Body is not FormData, nor a supported form encoding');
        });
    }

    /**
     * Reads and parses the body as JSON (if possible).
     */
    async json<T = unknown>(): Promise<T> {
        return this.consumeBody(async (input) => {
            if (typeof input === 'string') return JSON.parse(input) as T;
            if (TangoBody.isJsonValue(input)) return input as T;
            if (isArrayBuffer(input) || isUint8Array(input)) {
                const text = new TextDecoder().decode(isUint8Array(input) ? input : new Uint8Array(input));
                return JSON.parse(text) as T;
            }
            if (isReadableStream(input)) {
                const text = await TangoBody.readStreamToText(input);
                return JSON.parse(text) as T;
            }
            throw new TypeError('Body is not valid JSON');
        });
    }

    /**
     * Reads the body as UTF-8 string.
     */
    async text(): Promise<string> {
        return this.consumeBody(async (input) => {
            if (typeof input === 'string') return input;
            if (isArrayBuffer(input)) return new TextDecoder().decode(input);
            if (isUint8Array(input)) return new TextDecoder().decode(input);
            if (isBlob(input)) return await input.text();
            if (isReadableStream(input)) return await TangoBody.readStreamToText(input);
            if (TangoBody.isJsonValue(input)) return JSON.stringify(input);
            throw new TypeError('Body is not text, ArrayBuffer, Uint8Array, Blob, stream, or JSON serializable object');
        });
    }

    /**
     * Returns the original body value (may be used for streaming or clone).
     */
    getRawBodyInit(): TangoBodySource {
        return this.bodySourceInternal;
    }

    /**
     * Clone the body instance and stream if possible.
     * If the source is a stream, the stream will be cloned if readable, otherwise throws.
     */
    clone(): TangoBody {
        if (this.bodyUsedInternal) throw new TypeError('Body has already been used.');
        if (isReadableStream(this.bodySourceInternal)) {
            if (typeof this.bodySourceInternal.tee !== 'function') {
                throw new TypeError('Cannot clone: body is a ReadableStream and tee() is not available');
            }
            const [streamForOriginal, streamForClone] = this.bodySourceInternal.tee();
            this.bodySourceInternal = streamForOriginal;
            return new TangoBody(streamForClone, this.headers);
        }
        const cloneSource = TangoBody.deepCloneBody(this.bodySourceInternal);
        return new TangoBody(cloneSource, this.headers);
    }

    /**
     * Helper for all readers. Only allows reading once.
     */
    private async consumeBody<T>(parser: (input: TangoBodySource) => Promise<T>): Promise<T> {
        if (this.bodyUsedInternal) {
            throw new TypeError('Body has already been consumed.');
        }
        this.bodyUsedInternal = true;
        return parser(this.bodySourceInternal);
    }
}
