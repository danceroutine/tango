import { describe, expect, it } from 'vitest';
import { isArrayBuffer } from '../index';

describe(isArrayBuffer, () => {
    it('returns true for ArrayBuffer instances', () => {
        expect(isArrayBuffer(new ArrayBuffer(8))).toBe(true);
    });

    it('returns false for Uint8Array', () => {
        expect(isArrayBuffer(new Uint8Array([1, 2, 3]))).toBe(false);
    });
});
