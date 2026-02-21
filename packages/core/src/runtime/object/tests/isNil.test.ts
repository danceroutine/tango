import { describe, expect, it } from 'vitest';
import { isNil } from '../index';

describe(isNil, () => {
    it('returns true for null and undefined', () => {
        expect(isNil(null)).toBe(true);
        expect(isNil(undefined)).toBe(true);
    });

    it('returns false for non-nil values', () => {
        expect(isNil(0)).toBe(false);
    });
});
