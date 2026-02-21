import { describe, expect, it } from 'vitest';
import { isBlob } from '../index';

describe(isBlob, () => {
    it('returns true for Blob instances', () => {
        expect(isBlob(new Blob(['abc'], { type: 'text/plain' }))).toBe(true);
    });

    it('returns false for plain objects', () => {
        expect(isBlob({})).toBe(false);
    });
});
