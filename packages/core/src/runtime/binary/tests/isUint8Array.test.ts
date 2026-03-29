import { describe, expect, it } from 'vitest';
import { isUint8Array } from '../index';

describe(isUint8Array, () => {
    it('returns true for Uint8Array instances', () => {
        expect(isUint8Array(new Uint8Array([1, 2, 3]))).toBe(true);
    });

    it('returns false for ArrayBuffer', () => {
        expect(isUint8Array(new ArrayBuffer(8))).toBe(false);
    });
});
