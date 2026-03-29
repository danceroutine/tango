import { describe, expect, it } from 'vitest';
import { TangoBody } from '../TangoBody';

function streamFromText(text: string): ReadableStream<Uint8Array> {
    const encoded = new TextEncoder().encode(text);
    return new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(encoded);
            controller.close();
        },
    });
}

describe(TangoBody, () => {
    it('identifies tango bodies and recognizes supported body kinds', () => {
        const jsonBody = new TangoBody({ a: [1, 'x', true, null] });
        expect(TangoBody.isTangoBody(jsonBody)).toBe(true);
        expect(TangoBody.isTangoBody({})).toBe(false);
        expect(jsonBody.bodyType).toBe('JsonValue');

        expect(new TangoBody(null).bodyType).toBe('null');
        expect(new TangoBody('x').bodyType).toBe('string');
        expect(new TangoBody(new ArrayBuffer(1)).bodyType).toBe('ArrayBuffer');
        expect(new TangoBody(new Uint8Array([1])).bodyType).toBe('Uint8Array');
        expect(new TangoBody(new Blob(['x'])).bodyType).toBe('Blob');
        expect(new TangoBody(new FormData()).bodyType).toBe('FormData');
        expect(new TangoBody(new URLSearchParams('a=1')).bodyType).toBe('URLSearchParams');
        expect(new TangoBody(streamFromText('a')).bodyType).toBe('ReadableStream');

        expect(TangoBody.isJsonValue({ a: [1, 'x'] })).toBe(true);
        expect(TangoBody.isJsonValue(new Date())).toBe(false);
        expect(new TangoBody(new Date() as unknown as BodyInit).bodyType).toBe('object');
    });

    it('reads the same body through each supported representation', async () => {
        const stringBody = new TangoBody('hello');
        expect(new TextDecoder().decode(await stringBody.bytes())).toBe('hello');

        const u8Body = new TangoBody(new Uint8Array([104, 105]));
        expect(await u8Body.text()).toBe('hi');

        const abBody = new TangoBody(new TextEncoder().encode('ab').buffer);
        expect(await abBody.text()).toBe('ab');

        const blobBody = new TangoBody(new Blob(['blob']));
        expect(await blobBody.text()).toBe('blob');

        const streamBody = new TangoBody(streamFromText('stream'));
        expect(await streamBody.text()).toBe('stream');

        const jsonValueBody = new TangoBody({ x: 1, y: ['a'] });
        expect(await jsonValueBody.json()).toEqual({ x: 1, y: ['a'] });

        const jsonStringBody = new TangoBody('{"k":2}');
        expect(await jsonStringBody.json()).toEqual({ k: 2 });

        const arrayBufferValue = await new TangoBody('abc').arrayBuffer();
        expect(new TextDecoder().decode(new Uint8Array(arrayBufferValue))).toBe('abc');

        const rawArrayBuffer = await new TangoBody(new Uint8Array([1]).buffer).arrayBuffer();
        expect(rawArrayBuffer.byteLength).toBe(1);

        const fromUint8 = await new TangoBody(new Uint8Array([65, 66])).arrayBuffer();
        expect(new TextDecoder().decode(new Uint8Array(fromUint8))).toBe('AB');

        const fromStreamBuffer = await new TangoBody(streamFromText('arr-stream')).arrayBuffer();
        expect(new TextDecoder().decode(new Uint8Array(fromStreamBuffer))).toBe('arr-stream');

        const fromBlobBuffer = await new TangoBody(new Blob(['blob-array-buffer'])).arrayBuffer();
        expect(new TextDecoder().decode(new Uint8Array(fromBlobBuffer))).toBe('blob-array-buffer');

        const fromJsonBuffer = await new TangoBody({ j: 1 }).arrayBuffer();
        expect(new TextDecoder().decode(new Uint8Array(fromJsonBuffer))).toBe('{"j":1}');

        const blobValue = await new TangoBody({ a: 1 }).blob();
        expect(await blobValue.text()).toBe('{"a":1}');

        const blobFromBlob = await new TangoBody(new Blob(['blob-direct'])).blob();
        expect(await blobFromBlob.text()).toBe('blob-direct');

        const blobFromArrayBuffer = await new TangoBody(new TextEncoder().encode('buf').buffer).blob();
        expect(await blobFromArrayBuffer.text()).toBe('buf');

        const blobFromUint8 = await new TangoBody(new Uint8Array([98, 121, 116, 101])).blob();
        expect(await blobFromUint8.text()).toBe('byte');

        const streamBlob = await new TangoBody(streamFromText('stream-blob')).blob();
        expect(await streamBlob.text()).toBe('stream-blob');

        const bytesFromUint8 = await new TangoBody(new Uint8Array([49, 50])).bytes();
        expect(new TextDecoder().decode(bytesFromUint8)).toBe('12');

        const bytesFromArrayBuffer = await new TangoBody(new TextEncoder().encode('ab').buffer).bytes();
        expect(new TextDecoder().decode(bytesFromArrayBuffer)).toBe('ab');

        const bytesFromBlob = await new TangoBody(new Blob(['blob-bytes'])).bytes();
        expect(new TextDecoder().decode(bytesFromBlob)).toBe('blob-bytes');

        const streamBytes = await new TangoBody(streamFromText('stream-bytes')).bytes();
        expect(new TextDecoder().decode(streamBytes)).toBe('stream-bytes');

        const jsonBytes = await new TangoBody({ ok: true }).bytes();
        expect(new TextDecoder().decode(jsonBytes)).toBe('{"ok":true}');
    });

    it('parses form data from supported inputs', async () => {
        const form = new FormData();
        form.append('x', '1');
        const formBody = new TangoBody(form);
        expect((await formBody.formData()).get('x')).toBe('1');

        const urlEncoded = new TangoBody('a=1&b=two', {
            get(name: string) {
                return name === 'Content-Type' ? 'application/x-www-form-urlencoded' : null;
            },
        });
        const parsed = await urlEncoded.formData();
        expect(parsed.get('a')).toBe('1');
        expect(parsed.get('b')).toBe('two');

        const multipartRaw =
            '--boundary\r\nContent-Disposition: form-data; name="title"\r\n\r\nhello\r\n--boundary--\r\n';
        const multipart = new TangoBody(multipartRaw, {
            get(name: string) {
                return name === 'Content-Type' ? 'multipart/form-data; boundary=boundary' : null;
            },
        });
        const multipartParsed = await multipart.formData();
        expect(multipartParsed.get('title')).toBe('hello');

        const multipartWithIgnoredPart =
            '--boundary\r\nContent-Type: text/plain\r\n\r\nignore\r\n--boundary\r\nContent-Disposition: form-data; name="title"\r\n\r\nhello\r\n--boundary--\r\n';
        const multipartIgnoredBody = new TangoBody(multipartWithIgnoredPart, {
            get(name: string) {
                return name === 'Content-Type' ? 'multipart/form-data; boundary=boundary' : null;
            },
        });
        const parsedWithIgnoredPart = await multipartIgnoredBody.formData();
        expect(parsedWithIgnoredPart.get('title')).toBe('hello');

        const abEncoded = new TextEncoder().encode('c=3').buffer;
        const arrayBufferEncoded = new TangoBody(abEncoded, {
            get(name: string) {
                return name === 'Content-Type' ? 'application/x-www-form-urlencoded' : null;
            },
        });
        expect((await arrayBufferEncoded.formData()).get('c')).toBe('3');

        const uint8Encoded = new TextEncoder().encode('d=4');
        const uint8Body = new TangoBody(uint8Encoded, {
            get(name: string) {
                return name === 'Content-Type' ? 'application/x-www-form-urlencoded' : null;
            },
        });
        expect((await uint8Body.formData()).get('d')).toBe('4');
    });

    it('throws on invalid parsing flows and enforces one-time body consumption', async () => {
        await expect(new TangoBody('x', { get: () => 'multipart/form-data' }).formData()).rejects.toThrow(
            'Missing boundary'
        );
        await expect(new TangoBody('x', { get: () => null }).formData()).rejects.toThrow('supported form encoding');
        await expect(new TangoBody('x').formData()).rejects.toThrow('supported form encoding');
        await expect(new TangoBody(new Date() as unknown as BodyInit).formData()).rejects.toThrow(
            'not valid for FormData'
        );
        const unsupported = new Date() as unknown as BodyInit;
        await expect(new TangoBody(unsupported).text()).rejects.toThrow();
        await expect(new TangoBody(unsupported).json()).rejects.toThrow();
        await expect(new TangoBody(unsupported).bytes()).rejects.toThrow();
        await expect(new TangoBody(unsupported).arrayBuffer()).rejects.toThrow();
        await expect(new TangoBody(unsupported).blob()).rejects.toThrow();

        const once = new TangoBody('once');
        await once.text();
        await expect(once.text()).rejects.toThrow('already been consumed');
    });

    it('clones deep body values and handles stream clone semantics', async () => {
        expect(TangoBody.deepCloneBody(null)).toBeNull();
        expect(TangoBody.deepCloneBody('x')).toBe('x');
        expect((TangoBody.deepCloneBody(new ArrayBuffer(2)) as ArrayBuffer)?.byteLength).toBe(2);
        expect(TangoBody.deepCloneBody(new Uint8Array([1]))).toEqual(new Uint8Array([1]));
        expect(TangoBody.deepCloneBody(new Blob(['blob']))).toBeInstanceOf(Blob);
        expect(TangoBody.deepCloneBody({ x: { y: [1, 2] } })).toEqual({ x: { y: [1, 2] } });

        const fd = new FormData();
        fd.append('k', 'v');
        const clonedFd = TangoBody.deepCloneBody(fd) as FormData;
        expect(clonedFd.get('k')).toBe('v');

        const fdWithFile = new FormData();
        fdWithFile.append('avatar', new File(['img'], 'avatar.png', { type: 'image/png' }));
        const clonedFdWithFile = TangoBody.deepCloneBody(fdWithFile) as FormData;
        const clonedFile = clonedFdWithFile.get('avatar');
        expect(clonedFile).toBeInstanceOf(File);

        const unsupported = TangoBody.deepCloneBody(new Date() as unknown as BodyInit);
        expect(unsupported).toBeNull();

        expect(() => TangoBody.deepCloneBody(streamFromText('s'))).toThrow('Cannot deep clone a ReadableStream');

        const streamBody = new TangoBody(streamFromText('hello'));
        const clone = streamBody.clone();
        expect(await streamBody.text()).toBe('hello');
        expect(await clone.text()).toBe('hello');

        const consumed = new TangoBody('done');
        await consumed.text();
        expect(() => consumed.clone()).toThrow('already been used');

        const plainClone = new TangoBody('plain');
        const plainCloneCopy = plainClone.clone();
        expect(await plainClone.text()).toBe('plain');
        expect(await plainCloneCopy.text()).toBe('plain');

        const streamWithoutTee = streamFromText('no-tee') as ReadableStream<Uint8Array> & { tee?: () => never };
        Object.defineProperty(streamWithoutTee, 'tee', { value: undefined });
        const noTeeBody = new TangoBody(streamWithoutTee);
        expect(() => noTeeBody.clone()).toThrow('tee() is not available');
    });

    it('reports content type and length from the body value', async () => {
        expect(TangoBody.detectContentType('x')).toContain('text/plain');
        expect(TangoBody.detectContentType(new Uint8Array([1]))).toBe('application/octet-stream');
        expect(TangoBody.detectContentType(new Blob(['x'], { type: 'a/b' }))).toBe('a/b');
        expect(TangoBody.detectContentType(new Blob(['x']))).toBe('application/octet-stream');
        expect(TangoBody.detectContentType(new FormData())).toBeUndefined();
        expect(TangoBody.detectContentType({ a: 1 })).toContain('application/json');
        expect(TangoBody.detectContentType(streamFromText('x'))).toBeUndefined();
        expect(
            TangoBody.detectContentType(new Date() as unknown as Parameters<typeof TangoBody.detectContentType>[0])
        ).toBeUndefined();
        expect(TangoBody.detectContentType(null)).toBeUndefined();
        expect(TangoBody.detectContentType('x', 'custom/type')).toBe('custom/type');

        await expect(TangoBody.getContentLength(null)).resolves.toBe(0);
        await expect(TangoBody.getContentLength('abc')).resolves.toBe(3);
        await expect(TangoBody.getContentLength(new Uint8Array([1, 2]))).resolves.toBe(2);
        await expect(TangoBody.getContentLength(new ArrayBuffer(4))).resolves.toBe(4);
        await expect(TangoBody.getContentLength(new Blob(['abc']))).resolves.toBe(3);
        await expect(TangoBody.getContentLength({ a: 1 })).resolves.toBe(7);
        await expect(TangoBody.getContentLength(new FormData())).resolves.toBeUndefined();
    });

    it('parses JSON from binary inputs and preserves the original body', async () => {
        const fromArrayBuffer = await new TangoBody(new TextEncoder().encode('{"a":1}').buffer).json<{ a: number }>();
        expect(fromArrayBuffer.a).toBe(1);

        const fromUint8 = await new TangoBody(new TextEncoder().encode('{"b":2}')).json<{ b: number }>();
        expect(fromUint8.b).toBe(2);

        const fromStream = await new TangoBody(streamFromText('{"c":3}')).json<{ c: number }>();
        expect(fromStream.c).toBe(3);

        const jsonAsText = await new TangoBody({ c: 3 }).text();
        expect(jsonAsText).toBe('{"c":3}');

        const raw = new TangoBody('raw-body');
        expect(raw.getRawBodyInit()).toBe('raw-body');
    });
});
