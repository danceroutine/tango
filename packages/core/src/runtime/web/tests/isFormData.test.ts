import { describe, expect, it } from 'vitest';
import { isFormData } from '../index';

describe(isFormData, () => {
    it('returns true for FormData instances', () => {
        const fd = new FormData();
        fd.append('a', 'b');
        expect(isFormData(fd)).toBe(true);
    });

    it('returns false for URLSearchParams', () => {
        expect(isFormData(new URLSearchParams('a=1'))).toBe(false);
    });
});
