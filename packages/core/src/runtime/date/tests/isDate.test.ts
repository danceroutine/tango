import { describe, expect, it } from 'vitest';
import { isDate } from '../index';

describe(isDate, () => {
    it('returns true for Date instances', () => {
        expect(isDate(new Date())).toBe(true);
    });

    it('returns false for date-like strings', () => {
        expect(isDate('2020-01-01')).toBe(false);
    });
});
