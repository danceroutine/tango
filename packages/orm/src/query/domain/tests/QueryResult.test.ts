import { describe, expect, it } from 'vitest';
import { QueryResult } from '../QueryResult';

describe(QueryResult.name, () => {
    it('narrows instances with isQueryResult', () => {
        const r = new QueryResult([1]);
        expect(QueryResult.isQueryResult<number>(r)).toBe(true);
        expect(QueryResult.isQueryResult<number>([1])).toBe(false);
    });

    it('exposes length and map over rows', () => {
        const r = new QueryResult([{ id: 1 }, { id: 2 }]);
        expect(r.length).toBe(2);
        expect(r.map((row) => row.id)).toEqual([1, 2]);
    });

    it('supports at for indexed access', () => {
        const r = new QueryResult(['a', 'b']);
        expect(r.at(0)).toBe('a');
        expect(r.at(-1)).toBe('b');
        expect(r.at(2)).toBeUndefined();
    });

    it('remains iterable', () => {
        const r = new QueryResult([{ a: 1 }, { a: 2 }]);
        expect([...r]).toEqual([{ a: 1 }, { a: 2 }]);
    });

    it('returns a plain array from toArray', () => {
        const r = new QueryResult([1, 2]);
        const copy = r.toArray();
        expect(copy).toEqual([1, 2]);
        expect(copy).not.toBe(r.items);
    });

    it('serializes to JSON with results and next cursor', () => {
        const r = new QueryResult([1, 2], { nextCursor: 'c' });
        expect(r.toJSON()).toEqual({ results: [1, 2], nextCursor: 'c' });
        expect(new QueryResult([1]).toJSON()).toEqual({ results: [1], nextCursor: null });
    });

    it('still exposes rows through the compatibility accessor', () => {
        const r = new QueryResult([9]);
        expect(r.results).toEqual([9]);
        expect(r.results).toEqual([9]);
    });
});
