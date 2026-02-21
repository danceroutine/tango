import { describe, expect, it } from 'vitest';
import { isURLSearchParams } from '../index';

describe(isURLSearchParams, () => {
    it('returns true for URLSearchParams instances', () => {
        expect(isURLSearchParams(new URLSearchParams('a=1'))).toBe(true);
    });

    it('returns false for FormData', () => {
        expect(isURLSearchParams(new FormData())).toBe(false);
    });
});
