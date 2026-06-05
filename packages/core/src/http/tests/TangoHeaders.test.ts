import { describe, expect, it } from 'vitest';
import { TangoHeaders } from '../TangoHeaders';

describe(TangoHeaders, () => {
    it('updates, clones, and identifies tango headers', () => {
        const headers = new TangoHeaders({ A: '1' });
        expect(TangoHeaders.isTangoHeaders(headers)).toBe(true);
        expect(TangoHeaders.isTangoHeaders({})).toBe(false);

        headers.setHeader('X-Test', 'a');
        headers.appendHeader('X-Test', 'b');
        expect(headers.getHeader('X-Test')).toContain('a');
        expect(headers.hasHeader('X-Test')).toBe(true);

        headers.ensureUnique('X-Test', 'z');
        expect(headers.getHeader('X-Test')).toBe('z');

        headers.deleteHeader('X-Test');
        expect(headers.hasHeader('X-Test')).toBe(false);

        headers.vary('Accept', 'Accept-Language');
        headers.vary('Accept');
        headers.vary('   ');
        headers.vary();
        expect(headers.get('Vary')).toBe('Accept, Accept-Language');

        const varied = new TangoHeaders({ Vary: 'Accept, , Accept-Encoding' });
        varied.vary('X-Trace');
        expect(varied.get('Vary')).toContain('X-Trace');

        const copy = headers.clone();
        expect(copy.get('A')).toBe('1');
        expect(copy).not.toBe(headers);
    });

    it('stores cookies and common response headers', () => {
        const headers = new TangoHeaders();

        headers.setCookie('token', 'abc', {
            domain: 'example.com',
            path: '/api',
            maxAge: 30,
            httpOnly: true,
            secure: true,
            sameSite: 'Lax',
            priority: 'High',
            partitioned: true,
            expires: new Date(0),
        });
        headers.appendCookie('theme', 'dark');
        headers.appendCookie('nil', undefined as unknown as string);
        headers.deleteCookie('token', { path: '/', secure: true, sameSite: 'Strict' });

        const setCookie = headers.get('Set-Cookie') ?? '';
        expect(setCookie).toContain('token=abc');
        expect(setCookie).toContain('theme=dark');
        expect(setCookie).toContain('Max-Age=0');

        headers.cacheControl({ noStore: true, maxAge: 60, staleWhileRevalidate: 10, private: false });
        expect(headers.get('Cache-Control')).toContain('no-store');
        expect(headers.get('Cache-Control')).toContain('max-age=60');
        expect(headers.get('Cache-Control')).toContain('stale-while-revalidate=10');

        headers.cacheControl('public, max-age=20');
        expect(headers.get('Cache-Control')).toBe('public, max-age=20');

        const emptyCache = new TangoHeaders();
        emptyCache.cacheControl({ noStore: false, token: '', omitted: undefined });
        expect(emptyCache.get('Cache-Control')).toBeNull();

        const stringCache = new TangoHeaders();
        stringCache.cacheControl({ policy: 'private' });
        expect(stringCache.get('Cache-Control')).toBe('policy=private');

        headers.location('/users/1');
        headers.contentType('application/json');
        expect(headers.get('Location')).toBe('/users/1');
        expect(headers.get('Content-Type')).toBe('application/json');
    });

    it('replaces helper-managed cookie intent by name, domain, and path', () => {
        const headers = new TangoHeaders();

        headers.setCookie('session', 'old');
        headers.setCookie('session', 'new');
        headers.setCookie('session', 'api', { path: '/api' });
        headers.setCookie('session', 'domain', { domain: 'example.com' });
        headers.appendCookie('session', 'extra');
        headers.deleteCookie('session');

        const setCookie = headers.getSetCookie();
        expect(setCookie).not.toContain('session=old; Path=/');
        expect(setCookie).not.toContain('session=new; Path=/');
        expect(setCookie).toContain('session=api; Path=/api');
        expect(setCookie).toContain('session=domain; Domain=example.com; Path=/');
        expect(setCookie.filter((cookie) => cookie.startsWith('session=extra;'))).toHaveLength(0);
        expect(setCookie).toContain('session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0');
    });

    it('preserves appended and cloned cookie lines', () => {
        const headers = new TangoHeaders();
        headers.appendCookie('session', 'one');
        headers.appendCookie('session', 'two');
        headers.append('Set-Cookie', 'raw=1; Path=/');

        const copy = headers.clone();
        copy.setCookie('session', 'three');

        expect(headers.getSetCookie()).toEqual(['session=one; Path=/', 'session=two; Path=/', 'raw=1; Path=/']);
        expect(copy.getSetCookie()).toEqual(['raw=1; Path=/', 'session=three; Path=/']);
    });

    it('preserves set-cookie lines from header init values and raw mutations', () => {
        const source = new TangoHeaders();
        source.setHeader('X-Test', 'source');
        source.setCookie('session', 'source');
        source.append('Set-Cookie', 'raw=1; Path=/');

        const fromTangoHeaders = new TangoHeaders(source);
        expect(fromTangoHeaders.get('X-Test')).toBe('source');
        expect(fromTangoHeaders.getSetCookie()).toEqual(['session=source; Path=/', 'raw=1; Path=/']);

        const native = new Headers();
        native.set('X-Test', 'native');
        native.append('Set-Cookie', 'native=1; Path=/');
        const fromNativeHeaders = new TangoHeaders(native);
        expect(fromNativeHeaders.get('X-Test')).toBe('native');
        expect(fromNativeHeaders.getSetCookie()).toEqual(['native=1; Path=/']);

        const fromArray = new TangoHeaders([
            ['X-Test', 'array'],
            ['Set-Cookie', 'array=1; Path=/'],
        ]);
        expect(fromArray.get('X-Test')).toBe('array');
        expect(fromArray.getSetCookie()).toEqual(['array=1; Path=/']);

        const fromObject = new TangoHeaders({ 'Set-Cookie': 'object=1; Path=/' });
        expect(fromObject.getSetCookie()).toEqual(['object=1; Path=/']);

        fromArray.set('Set-Cookie', 'reset=1; Path=/');
        expect(fromArray.getSetCookie()).toEqual(['reset=1; Path=/']);

        fromArray.delete('Set-Cookie');
        expect(fromArray.getSetCookie()).toEqual([]);
        expect(fromArray.has('Set-Cookie')).toBe(false);
    });

    it('infers content metadata and preserves trace headers', () => {
        const bodyBytes = new Uint8Array([120]);
        const headers = new TangoHeaders();
        headers.setContentTypeForBody(bodyBytes, 'a.txt');
        expect(headers.get('Content-Type')).toBe('text/plain');

        const unknown = new TangoHeaders();
        unknown.setContentTypeForBody(bodyBytes, 'a.unknown');
        expect(unknown.get('Content-Type')).toBe('application/octet-stream');

        const noExtension = new TangoHeaders();
        noExtension.setContentTypeForBody(bodyBytes, 'README');
        expect(noExtension.get('Content-Type')).toBe('application/octet-stream');

        const blob = new Blob(['abc'], { type: 'text/custom' });
        const blobHeaders = new TangoHeaders();
        blobHeaders.setContentTypeForBody(blob);
        expect(blobHeaders.get('Content-Type')).toBe('text/custom');

        const emptyBlobHeaders = new TangoHeaders();
        emptyBlobHeaders.setContentTypeForBody(new Blob(['abc']));
        expect(emptyBlobHeaders.get('Content-Type')).toBe('application/octet-stream');

        const fallbackHeaders = new TangoHeaders();
        fallbackHeaders.setContentTypeForBody({});
        expect(fallbackHeaders.get('Content-Type')).toBe('application/octet-stream');

        const keepTypeHeaders = new TangoHeaders({ 'Content-Type': 'keep/me' });
        keepTypeHeaders.setContentTypeForBody(bodyBytes, 'a.json');
        expect(keepTypeHeaders.get('Content-Type')).toBe('keep/me');

        const deprecatedHeaders = new TangoHeaders();
        deprecatedHeaders.setContentTypeByFile(bodyBytes, 'a.txt');
        expect(deprecatedHeaders.get('Content-Type')).toBe('text/plain');

        const lenHeaders = new TangoHeaders();
        lenHeaders.setContentLengthFromBody('hello');
        expect(lenHeaders.get('Content-Length')).toBe('5');

        const abLen = new TangoHeaders();
        abLen.setContentLengthFromBody(new ArrayBuffer(3));
        expect(abLen.get('Content-Length')).toBe('3');

        const u8Len = new TangoHeaders();
        u8Len.setContentLengthFromBody(new Uint8Array([1, 2]));
        expect(u8Len.get('Content-Length')).toBe('2');

        const blobLen = new TangoHeaders();
        blobLen.setContentLengthFromBody(new Blob(['abcd']));
        expect(blobLen.get('Content-Length')).toBe('4');

        const sizeLen = new TangoHeaders();
        sizeLen.setContentLengthFromBody({ size: 7 });
        expect(sizeLen.get('Content-Length')).toBe('7');

        const genericLen = new TangoHeaders();
        genericLen.setContentLengthFromBody({ length: 9 });
        expect(genericLen.get('Content-Length')).toBe('9');

        const nodeBufferLen = new TangoHeaders();
        nodeBufferLen.setContentLengthFromBody(Buffer.from('abc'));
        expect(nodeBufferLen.get('Content-Length')).toBe('3');

        const nullLen = new TangoHeaders();
        nullLen.setContentLengthFromBody(null);
        expect(nullLen.get('Content-Length')).toBeNull();

        const fixedLen = new TangoHeaders({ 'Content-Length': '11' });
        fixedLen.setContentLengthFromBody('abc');
        expect(fixedLen.get('Content-Length')).toBe('11');

        const unknownLen = new TangoHeaders();
        unknownLen.setContentLengthFromBody({ value: true });
        expect(unknownLen.get('Content-Length')).toBeNull();

        const trace = new TangoHeaders();
        trace.withRequestId('req-1').withTraceParent('00-abc-def-01').withServerTiming('db', 12.5, 'query');
        trace.appendServerTimingRaw('app;dur=3');
        trace.withResponseTime(18);
        trace.withServerTiming('network');

        expect(trace.getRequestId()).toBe('req-1');
        expect(trace.getTraceParent()).toBe('00-abc-def-01');
        expect(trace.getServerTiming()).toContain('db;dur=12.5;desc="query"');
        expect(trace.getServerTiming()).toContain('app;dur=3');
        expect(trace.getResponseTime()).toBe('18ms');

        trace.withResponseTime('20ms');
        expect(trace.getResponseTime()).toBe('20ms');

        trace.withServerTiming('render', 3);
        expect(trace.getServerTiming()).toContain('render;dur=3');

        trace.setContentDispositionInline('my report.csv');
        expect(trace.get('Content-Disposition')).toContain('inline; filename="my%20report.csv"');
        trace.setContentDispositionAttachment('my report.csv');
        expect(trace.get('Content-Disposition')).toContain('attachment; filename="my%20report.csv"');

        const rawOnly = new TangoHeaders();
        rawOnly.appendServerTimingRaw('cache;dur=1');
        expect(rawOnly.get('Server-Timing')).toBe('cache;dur=1');
    });
});
