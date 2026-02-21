import { describe, expect, it } from 'vitest';
import { isFile } from '../index';

describe(isFile, () => {
    it('returns true for File instances', () => {
        expect(isFile(new File(['abc'], 'a.txt', { type: 'text/plain' }))).toBe(true);
    });

    it('returns false for Blob instances', () => {
        expect(isFile(new Blob(['abc'], { type: 'text/plain' }))).toBe(false);
    });
});
