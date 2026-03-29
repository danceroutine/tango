import { describe, expect, it } from 'vitest';
import { isObject } from '../index';

describe(isObject, () => {
    it('returns true for plain objects', () => {
        expect(isObject({ a: 1 })).toBe(true);
    });

    it('returns false for null', () => {
        expect(isObject(null)).toBe(false);
    });
});
