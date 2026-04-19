import { describe, expect, it } from 'vitest';
import { aQueryResult } from '../aQueryResult';

describe(aQueryResult, () => {
    it('returns default query-result shape', () => {
        const result = aQueryResult();
        expect(result.items).toEqual([]);
        expect(result.length).toBe(0);
    });

    it('applies provided overrides', () => {
        const result = aQueryResult<number>({ results: [1, 2] });
        expect(result.items).toEqual([1, 2]);
        expect(result.length).toBe(2);
        expect(result.at(0)).toBe(1);
        expect(result.at(1)).toBe(2);
    });
});
