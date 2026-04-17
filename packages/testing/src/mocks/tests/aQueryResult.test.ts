import { describe, expect, it } from 'vitest';
import { aQueryResult } from '../aQueryResult';

describe(aQueryResult, () => {
    it('returns default query-result shape', () => {
        const result = aQueryResult();
        expect(result.toJSON()).toEqual({ results: [], nextCursor: null });
        expect([...result]).toEqual([]);
    });

    it('applies provided overrides', () => {
        const result = aQueryResult<number>({ results: [1, 2], nextCursor: 'abc' });
        expect(result.toJSON()).toEqual({
            results: [1, 2],
            nextCursor: 'abc',
        });
        expect([...result]).toEqual([1, 2]);
    });
});
