import { describe, expect, it } from 'vitest';
import { QueryResult } from '../QueryResult';

describe(QueryResult, () => {
    it('exposes length and map over rows', () => {
        const r = new QueryResult([{ id: 1 }, { id: 2 }]);
        expect(r.length).toBe(2);
        expect(r.map((row) => row.id)).toEqual([1, 2]);
    });

    it('remains iterable', () => {
        const r = new QueryResult([{ a: 1 }, { a: 2 }]);
        expect([...r]).toEqual([{ a: 1 }, { a: 2 }]);
    });
});
