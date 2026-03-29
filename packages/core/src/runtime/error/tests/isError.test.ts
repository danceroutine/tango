import { describe, expect, it } from 'vitest';
import { isError } from '../index';

describe(isError, () => {
    it('returns true for Error instances', () => {
        expect(isError(new Error('x'))).toBe(true);
    });

    it('returns false for plain objects', () => {
        expect(isError({})).toBe(false);
    });
});
