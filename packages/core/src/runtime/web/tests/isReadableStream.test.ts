import { describe, expect, it } from 'vitest';
import { isReadableStream } from '../index';

describe(isReadableStream, () => {
    it('returns true for ReadableStream instances', () => {
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('x'));
                controller.close();
            },
        });
        expect(isReadableStream(stream)).toBe(true);
    });

    it('returns false for plain objects', () => {
        expect(isReadableStream({})).toBe(false);
    });
});
