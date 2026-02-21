import { describe, expect, it } from 'vitest';
import { aQueryResult } from '../aQueryResult';

describe(aQueryResult, () => {
    it('returns default query-result shape', () => {
        expect(aQueryResult()).toEqual({ results: [], nextCursor: null });
    });

    it('applies provided overrides', () => {
        expect(aQueryResult<number>({ results: [1, 2], nextCursor: 'abc' })).toEqual({
            results: [1, 2],
            nextCursor: 'abc',
        });
    });
});
