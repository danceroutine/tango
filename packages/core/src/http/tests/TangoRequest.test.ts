import { describe, it, expect } from 'vitest';
import { TangoRequest } from '../TangoRequest';

function streamFromText(text: string): ReadableStream<Uint8Array> {
    const bytes = new TextEncoder().encode(text);
    return new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(bytes);
            controller.close();
        },
    });
}

describe(TangoRequest, () => {
    it('serializes object bodies as JSON', async () => {
        const request = new TangoRequest('https://example.test/users', {
            method: 'POST',
            body: { name: 'Pedro', active: true },
        });

        expect(request.headers.get('content-type')).toBe('application/json; charset=utf-8');
        expect(await request.text()).toBe('{"name":"Pedro","active":true}');
    });

    it('keeps an explicit content type when serializing JSON', async () => {
        const request = new TangoRequest('https://example.test/users', {
            method: 'POST',
            headers: { 'content-type': 'application/vnd.custom+json' },
            body: { name: 'Pedro' },
        });

        expect(request.headers.get('content-type')).toBe('application/vnd.custom+json');
        expect(await request.text()).toBe('{"name":"Pedro"}');
    });

    it('exposes text request bodies as bytes and through clones', async () => {
        const request = new TangoRequest('https://example.test/users', {
            method: 'POST',
            body: 'abc',
        });

        const requestInternals = request as unknown as {
            request: Request & { bytes?: () => Promise<Uint8Array<ArrayBuffer>> };
        };
        requestInternals.request.bytes = undefined as unknown as () => Promise<Uint8Array<ArrayBuffer>>;

        const clone = request.clone();
        const bytes = await request.bytes();
        expect(new TextDecoder().decode(bytes)).toBe('abc');
        expect(await clone.text()).toBe('abc');

        expect(() => request.clone()).toThrow();
    });

    it('reads bytes from the native request when available', async () => {
        const request = new TangoRequest('https://example.test/users', {
            method: 'POST',
            body: 'abc',
        });
        const requestInternals = request as unknown as {
            request: Request & { bytes?: () => Promise<Uint8Array<ArrayBuffer>> };
        };
        requestInternals.request.bytes = async () => new Uint8Array([120, 121, 122]) as Uint8Array<ArrayBuffer>;
        const bytes = await request.bytes();
        expect(new TextDecoder().decode(bytes)).toBe('xyz');
    });

    it('ignores request bodies for GET and HEAD requests', () => {
        const getReq = new TangoRequest('https://example.test/users', {
            method: 'GET',
            body: 'ignored',
        });
        const headReq = new TangoRequest('https://example.test/users', {
            method: 'HEAD',
            body: 'ignored',
        });

        expect(getReq.body).toBeNull();
        expect(headReq.body).toBeNull();

        const defaultReq = new TangoRequest('https://example.test/default');
        expect(defaultReq.method).toBe('GET');
    });

    it('accepts binary and web request body types', async () => {
        const ab = new TextEncoder().encode('ab').buffer;
        const abReq = new TangoRequest('https://example.test/a', { method: 'POST', body: ab });
        expect(await abReq.text()).toBe('ab');

        const u8Req = new TangoRequest('https://example.test/a', { method: 'POST', body: new Uint8Array([99]) });
        expect(await u8Req.text()).toBe('c');

        const blobReq = new TangoRequest('https://example.test/a', { method: 'POST', body: new Blob(['blob']) });
        expect(await blobReq.text()).toBe('blob');

        const paramsReq = new TangoRequest('https://example.test/a', {
            method: 'POST',
            body: new URLSearchParams('a=1'),
        });
        expect(await paramsReq.text()).toBe('a=1');

        const fd = new FormData();
        fd.append('a', '1');
        const fdReq = new TangoRequest('https://example.test/a', { method: 'POST', body: fd });
        expect(await fdReq.formData()).toBeInstanceOf(FormData);

        const streamReq = new TangoRequest('https://example.test/a', {
            method: 'POST',
            body: streamFromText('stream') as unknown as BodyInit,
        });
        expect(await streamReq.text()).toBe('stream');
    });

    it('preserves request metadata and identifies tango requests', async () => {
        const controller = new AbortController();
        const base = new Request('https://example.test/base', {
            method: 'PUT',
            headers: { 'x-base': '1' },
            body: 'base-body',
            redirect: 'manual',
            cache: 'default',
            credentials: 'same-origin',
            integrity: 'sha256-abc',
            keepalive: true,
            mode: 'same-origin',
            referrer: 'https://example.test/ref',
            referrerPolicy: 'origin',
            signal: controller.signal,
        });

        const request = new TangoRequest(base, {
            headers: { 'x-new': '2' },
            method: 'PATCH',
            body: '{"x":1}',
        });

        expect(TangoRequest.isTangoRequest(request)).toBe(true);
        expect(TangoRequest.isTangoRequest({})).toBe(false);

        expect(request.method).toBe('PATCH');
        expect(request.headers.get('x-new')).toBe('2');
        expect(request.cache).toBe('default');
        expect(request.credentials).toBe('same-origin');
        expect(typeof request.destination).toBe('string');
        expect(request.integrity).toBe('sha256-abc');
        expect(request.keepalive).toBe(true);
        expect(request.mode).toBe('same-origin');
        expect(request.redirect).toBe('manual');
        expect(request.referrer).toContain('https://example.test/ref');
        expect(request.referrerPolicy).toBe('origin');
        expect(request.signal.aborted).toBe(false);
        expect(request.url).toContain('/base');
        expect(request.bodySource).toBe('{"x":1}');

        const forArrayBuffer = new TangoRequest('https://example.test/array', { method: 'POST', body: 'z' });
        expect(await forArrayBuffer.arrayBuffer()).toBeInstanceOf(ArrayBuffer);

        const forBlob = new TangoRequest('https://example.test/blob', { method: 'POST', body: 'z' });
        expect(await forBlob.blob()).toBeInstanceOf(Blob);

        const forJson = new TangoRequest('https://example.test/json', { method: 'POST', body: '{"x":1}' });
        expect(await forJson.json()).toEqual({ x: 1 });

        const forText = new TangoRequest('https://example.test/text', { method: 'POST', body: '{"x":1}' });
        expect(await forText.text()).toBe('{"x":1}');
        expect(forText.bodyUsed).toBe(true);

        const inheritedMethod = new TangoRequest(
            new Request('https://example.test/implicit', {
                method: 'PUT',
                body: 'payload',
            })
        );
        expect(inheritedMethod.method).toBe('PUT');
    });

    it('exposes normalized query params from the request URL', () => {
        const request = new TangoRequest(
            'https://example.test/posts?search=%20hello%20&ordering=-createdAt,title&tag=orm&tag=http'
        );

        expect(request.queryParams.getSearch()).toBe('hello');
        expect(request.queryParams.getOrdering()).toEqual(['-createdAt', 'title']);
        expect(request.queryParams.getAll('tag')).toEqual(['orm', 'http']);
    });
});
