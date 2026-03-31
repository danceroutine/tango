import { describe, expect, it, vi } from 'vitest';
import { TangoResponse } from '../TangoResponse';
import { TangoError } from '../../errors/TangoError';

type EnvSnapshot = NodeJS.ProcessEnv;

class TestTangoError extends TangoError {
    status = 418;

    protected getErrorName(): string {
        return 'teapot';
    }

    protected getDetails() {
        return { foo: ['bar'] };
    }
}

function streamFromText(text: string): ReadableStream<Uint8Array> {
    const chunk = new TextEncoder().encode(text);
    return new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(chunk);
            controller.close();
        },
    });
}

describe(TangoResponse, () => {
    it('identifies tango responses and uses the default response state', () => {
        const response = new TangoResponse();
        expect(TangoResponse.isTangoResponse(response)).toBe(true);
        expect(TangoResponse.isTangoResponse({})).toBe(false);

        expect(response.status).toBe(200);
        expect(response.ok).toBe(true);
        expect(response.redirected).toBe(false);
        expect(response.statusText).toBe('');
        expect(response.type).toBe('default');
        expect(response.url).toBe('');

        const forced = new TangoResponse({ status: 500, ok: true });
        expect(forced.ok).toBe(true);
    });

    it('updates response metadata through the public header API', () => {
        const response = new TangoResponse();
        response.setHeader('X-Test', 'a');
        response.appendHeader('X-Test', 'b');
        expect(response.getHeader('X-Test')).toContain('a');
        expect(response.hasHeader('X-Test')).toBe(true);
        response.deleteHeader('X-Test');
        expect(response.hasHeader('X-Test')).toBe(false);

        response.vary('Accept');
        response.setCookie('a', '1');
        response.appendCookie('b', '2');
        response.deleteCookie('a');
        response.cacheControl({ noStore: true, maxAge: 10 });
        response.location('/x');
        response.contentType('application/json');

        response.withRequestId('req-1').withRequestId(undefined).withRequestId('');
        response.withTraceparent('tp').withTraceparent(null);
        response.withServerTiming('db;dur=2').withServerTiming(['app;dur=1']);
        response.withServerTiming(1 as unknown as string);
        response.withResponseTime(10).withResponseTime('9ms');
        response.withResponseTime({} as unknown as string);
        response.propagateTraceHeaders({ 'x-request-id': 'a', traceparent: 'b', 'server-timing': 'c' });
        response.propagateTraceHeaders({});

        expect(response.headers.get('x-request-id')).toBe('a');
        expect(response.headers.get('traceparent')).toBe('b');
        expect(response.headers.get('server-timing')).toBe('c');
    });

    it('serializes JSON, text, HTML, and stream bodies', async () => {
        const json = TangoResponse.json({ a: 1 });
        expect(json.headers.get('Content-Type')).toContain('application/json');
        expect(json.headers.get('Content-Length')).toBeTruthy();
        expect(await json.json()).toEqual({ a: 1 });

        const jsonKeep = TangoResponse.json({ a: 1 }, { headers: { 'Content-Type': 'custom' } });
        expect(jsonKeep.headers.get('Content-Type')).toBe('custom');

        const jsonKeepLength = TangoResponse.json({ a: 1 }, { headers: { 'Content-Length': '1' } });
        expect(jsonKeepLength.headers.get('Content-Length')).toBe('1');

        const text = TangoResponse.text('abc');
        expect(text.headers.get('Content-Type')).toContain('text/plain');
        expect(await text.text()).toBe('abc');

        const textKeepType = TangoResponse.text('abc', { headers: { 'Content-Type': 'x/custom' } });
        expect(textKeepType.headers.get('Content-Type')).toBe('x/custom');

        const textKeepLength = TangoResponse.text('abc', { headers: { 'Content-Length': '7' } });
        expect(textKeepLength.headers.get('Content-Length')).toBe('7');

        const html = TangoResponse.html('<p>x</p>');
        expect(html.headers.get('Content-Type')).toContain('text/html');
        expect(await html.text()).toBe('<p>x</p>');

        const htmlKeepType = TangoResponse.html('<p>x</p>', { headers: { 'Content-Type': 'text/custom' } });
        expect(htmlKeepType.headers.get('Content-Type')).toBe('text/custom');

        const htmlKeepLength = TangoResponse.html('<p>x</p>', { headers: { 'Content-Length': '9' } });
        expect(htmlKeepLength.headers.get('Content-Length')).toBe('9');

        const streamed = TangoResponse.stream(streamFromText('stream'));
        expect(await streamed.text()).toBe('stream');
    });

    it('returns the expected redirect and empty success responses', async () => {
        const redirect = TangoResponse.redirect('/next', 301);
        expect(redirect.status).toBe(301);
        expect(redirect.redirected).toBe(true);
        expect(redirect.url).toBe('/next');
        expect(redirect.headers.get('Location')).toBe('/next');

        const noContent = TangoResponse.noContent();
        expect(noContent.status).toBe(204);
        expect(noContent.bodySource).toBeNull();

        const createdWithBody = TangoResponse.created('/items/1', { id: 1 });
        expect(createdWithBody.status).toBe(201);
        expect(createdWithBody.headers.get('Location')).toBe('/items/1');
        expect(createdWithBody.headers.get('Content-Type')).toContain('application/json');
        expect(await createdWithBody.json()).toEqual({ id: 1 });

        const createdWithCustomType = TangoResponse.created(
            '/items/2',
            { id: 2 },
            { headers: { 'Content-Type': 'x/custom' } }
        );
        expect(createdWithCustomType.headers.get('Content-Type')).toBe('x/custom');

        const createdEmpty = TangoResponse.created();
        expect(createdEmpty.status).toBe(201);
        expect(createdEmpty.headers.get('Location')).toBeNull();

        const methodNotAllowed = TangoResponse.methodNotAllowed(['GET', 'POST']);
        expect(methodNotAllowed.status).toBe(405);
        expect(methodNotAllowed.headers.get('Allow')).toBe('GET, POST');
        expect(await methodNotAllowed.json()).toEqual({ error: 'Method not allowed.' });

        const methodNotAllowedWithoutAllow = TangoResponse.methodNotAllowed();
        expect(methodNotAllowedWithoutAllow.status).toBe(405);
        expect(methodNotAllowedWithoutAllow.headers.get('Allow')).toBeNull();
    });

    it('turns TangoError subclasses into problem responses', async () => {
        const tangoErr = new TestTangoError('teapot-msg');
        const fromError = TangoResponse.error(tangoErr);
        expect(fromError.status).toBe(418);
        expect(await fromError.json()).toEqual({
            error: { code: 'teapot', message: 'teapot-msg', details: { foo: ['bar'] } },
        });
    });

    it('turns problem-details objects into problem responses with custom status', () => {
        const fromProblemDetails = TangoResponse.error({ code: 'x', message: 'y', details: null }, { status: 499 });
        expect(fromProblemDetails.status).toBe(499);
    });

    it.each([
        ['badRequest', 'bad', 400],
        ['unauthorized', undefined, 401],
        ['forbidden', undefined, 403],
        ['notFound', undefined, 404],
        ['conflict', undefined, 409],
        ['unprocessableEntity', undefined, 422],
        ['tooManyRequests', undefined, 429],
    ] as const)('%s returns %i with problem+json content type', (method, arg, expectedStatus) => {
        const response = (TangoResponse[method] as (arg?: unknown) => TangoResponse)(arg);
        expect(response.status).toBe(expectedStatus);
        expect(response.headers.get('Content-Type')).toContain('application/problem+json');
    });

    it('returns problem+json for error helpers called with ProblemDetails or TangoError', () => {
        const fromProblem = TangoResponse.badRequest({ code: 'bad_request', message: 'oops' });
        expect(fromProblem.status).toBe(400);
        expect(fromProblem.headers.get('Content-Type')).toContain('application/problem+json');

        const fromTangoError = TangoResponse.unauthorized(new TestTangoError('u'));
        expect(fromTangoError.status).toBe(418);
        expect(fromTangoError.headers.get('Content-Type')).toContain('application/problem+json');
    });

    it.each([
        ['problem', 'a plain message', 500, { error: { code: 'error', message: 'a plain message' } }],
        ['badRequest', undefined, 400, { error: { code: 'bad_request', message: 'Bad Request' } }],
        ['unauthorized', 'needs login', 401, { error: { code: 'unauthorized', message: 'needs login' } }],
        ['forbidden', 'denied', 403, { error: { code: 'forbidden', message: 'denied' } }],
        ['notFound', 'missing', 404, { error: { code: 'not_found', message: 'missing' } }],
        ['conflict', 'conflict detail', 409, { error: { code: 'conflict', message: 'conflict detail' } }],
        [
            'unprocessableEntity',
            'bad payload',
            422,
            { error: { code: 'unprocessable_entity', message: 'bad payload' } },
        ],
        ['tooManyRequests', 'retry later', 429, { error: { code: 'too_many_requests', message: 'retry later' } }],
    ] as const)('%s(%s) returns %i with the expected body', async (method, arg, expectedStatus, expectedBody) => {
        const response = (TangoResponse[method] as (arg?: unknown) => TangoResponse)(arg);
        expect(response.status).toBe(expectedStatus);
        expect(await response.json()).toEqual(expectedBody);
    });

    it.each([
        ['forbidden', { code: 'forbidden', message: 'blocked' }, 403],
        ['conflict', { code: 'conflict', message: 'already exists' }, 409],
        ['tooManyRequests', { code: 'rate_limited', message: 'slow down' }, 429],
    ] as const)('%s with ProblemDetails returns %i with the given body', async (method, input, expectedStatus) => {
        const response = (TangoResponse[method] as (arg?: unknown) => TangoResponse)(input);
        expect(response.status).toBe(expectedStatus);
        expect(await response.json()).toEqual({ error: input });
    });

    it.each([
        ['notFound', 'gone', 418, { error: { code: 'teapot', message: 'gone', details: { foo: ['bar'] } } }],
        [
            'unprocessableEntity',
            'invalid',
            418,
            { error: { code: 'teapot', message: 'invalid', details: { foo: ['bar'] } } },
        ],
    ] as const)(
        '%s with TangoError uses the error status and envelope',
        async (method, msg, expectedStatus, expectedBody) => {
            const response = (TangoResponse[method] as (arg?: unknown) => TangoResponse)(new TestTangoError(msg));
            expect(response.status).toBe(expectedStatus);
            expect(await response.json()).toEqual(expectedBody);
        }
    );

    it('builds problem responses from objects and TangoError instances', async () => {
        const problemFromObject = TangoResponse.problem({
            code: 'x',
            message: 'm',
            details: null,
            fields: { a: ['b'] },
        });
        expect(await problemFromObject.json()).toEqual({
            error: { code: 'x', message: 'm', details: null, fields: { a: ['b'] } },
        });

        const problemFromTangoError = TangoResponse.problem(new TestTangoError('abc'));
        expect(problemFromTangoError.status).toBe(418);
    });

    it('preserves existing headers on problem responses', () => {
        const withExistingHeaders = TangoResponse.problem(undefined, {
            status: 503,
            headers: { 'Content-Type': 'custom/problem', 'Content-Length': '100' },
        });
        expect(withExistingHeaders.status).toBe(503);
        expect(withExistingHeaders.headers.get('Content-Type')).toBe('custom/problem');
        expect(withExistingHeaders.headers.get('Content-Length')).toBe('100');
    });

    it('preserves response data across cloning and file-style responses', async () => {
        const response = TangoResponse.stream(streamFromText('hello'));
        const cloned = response.clone();

        const [originalText, clonedText] = await Promise.all([response.text(), cloned.text()]);

        expect(originalText).toBe('hello');
        expect(clonedText).toBe('hello');

        const consumed = TangoResponse.text('already read');
        await consumed.text();
        expect(() => consumed.clone()).toThrow('Body has already been used');

        const jsonRes = TangoResponse.json({ a: 1 });
        const asArrayBuffer = await jsonRes.arrayBuffer();
        expect(asArrayBuffer.byteLength).toBeGreaterThan(0);

        const blobRes = TangoResponse.text('blob-me');
        expect(await (await blobRes.blob()).text()).toBe('blob-me');

        const bytesRes = TangoResponse.text('bytes-me');
        expect(new TextDecoder().decode(await bytesRes.bytes())).toBe('bytes-me');

        const formRes = new TangoResponse({
            body: 'a=1&b=2',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        const form = await formRes.formData();
        expect(form.get('a')).toBe('1');

        const fileInline = TangoResponse.file('abc', { filename: 'a.txt' });
        expect(fileInline.headers.get('Content-Disposition')).toContain('inline');

        const fileWithType = TangoResponse.file('abc', { contentType: 'text/custom' });
        expect(fileWithType.headers.get('Content-Type')).toBe('text/custom');

        const fileWithHeaderType = TangoResponse.file('abc', { init: { headers: { 'Content-Type': 'x/preferred' } } });
        expect(fileWithHeaderType.headers.get('Content-Type')).toBe('x/preferred');

        const fileWithHeaderLength = TangoResponse.file('abc', { init: { headers: { 'Content-Length': '99' } } });
        expect(fileWithHeaderLength.headers.get('Content-Length')).toBe('99');

        const downloadNamed = TangoResponse.download(new Blob(['abc']), { filename: 'a.txt' });
        expect(downloadNamed.headers.get('Content-Disposition')).toContain('attachment');

        const downloadUnnamed = TangoResponse.download('abc');
        expect(downloadUnnamed.headers.get('Content-Disposition')).toBe('attachment');

        const downloadWithType = TangoResponse.download('abc', { contentType: 'text/custom' });
        expect(downloadWithType.headers.get('Content-Type')).toBe('text/custom');

        const downloadWithHeaderType = TangoResponse.download('abc', {
            init: { headers: { 'Content-Type': 'x/preferred' } },
        });
        expect(downloadWithHeaderType.headers.get('Content-Type')).toBe('x/preferred');

        const downloadWithHeaderLength = TangoResponse.download('abc', {
            init: { headers: { 'Content-Length': '101' } },
        });
        expect(downloadWithHeaderLength.headers.get('Content-Length')).toBe('101');

        const debug = TangoResponse.text('debug').toJSON();
        expect(debug.status).toBe(200);
        expect(debug.headers['content-type']).toContain('text/plain');
        expect(debug.bodyType).toBeTruthy();
    });

    it('converts to a native web response without changing the Tango response', async () => {
        const json = TangoResponse.json({ ok: true }, { status: 202 });
        const webJson = json.toWebResponse();

        expect(webJson).toBeInstanceOf(Response);
        expect(TangoResponse.isTangoResponse(webJson)).toBe(false);
        expect(webJson.status).toBe(202);
        expect(await webJson.json()).toEqual({ ok: true });
        expect(await json.json()).toEqual({ ok: true });

        const streamed = TangoResponse.stream(streamFromText('native-stream'));
        const webStreamed = streamed.toWebResponse();

        expect(await webStreamed.text()).toBe('native-stream');
        expect(await streamed.text()).toBe('native-stream');

        const objectBacked = new TangoResponse({ body: { nested: { ok: true } } });
        const webObjectBacked = objectBacked.toWebResponse();
        expect(await webObjectBacked.json()).toEqual({ nested: { ok: true } });
    });

    it('guards __peekBodyForTestOnly in production-like env', () => {
        const originalEnv: EnvSnapshot = { ...process.env };
        try {
            process.env.NODE_ENV = 'test';
            const response = TangoResponse.text('peek');
            expect(response.__peekBodyForTestOnly()).toBe('peek');

            process.env.NODE_ENV = 'production';
            expect(() => response.__peekBodyForTestOnly()).toThrow('not available in production');

            process.env.NODE_ENV = 'prod';
            expect(() => response.__peekBodyForTestOnly()).toThrow('not available in production');
        } finally {
            process.env = originalEnv;
        }
    });

    it('allows __peekBodyForTestOnly when process is unavailable', () => {
        vi.stubGlobal('process', undefined);

        try {
            const response = TangoResponse.text('peek');
            expect(response.__peekBodyForTestOnly()).toBe('peek');
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it('returns JSON bodies through the generic response helper', async () => {
        const response = TangoResponse.json({ value: 'x' });
        const data = await response.json<{ value: string }>();
        expect(data.value).toBe('x');
    });

    it('handles branch in withServerTiming when timing is array and string', () => {
        const response = new TangoResponse();
        response.withServerTiming(['db;dur=1', 'app;dur=2']);
        expect(response.headers.get('Server-Timing')).toBe('db;dur=1, app;dur=2');

        response.withServerTiming('network;dur=3');
        expect(response.headers.get('Server-Timing')).toBe('network;dur=3');
    });

    it('falls back to a generic problem response for unknown errors', async () => {
        const spy = vi.spyOn(JSON, 'stringify');
        const response = TangoResponse.problem({ code: 1, message: 2 } as unknown as Record<string, unknown>);
        const body = await response.json();
        expect(body).toEqual({ error: { code: 'error', message: 'An error occurred' } });
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });
});
