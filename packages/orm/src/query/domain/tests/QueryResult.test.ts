import { beforeEach, describe, expect, it, vi } from 'vitest';

const warn = vi.fn();

vi.mock('@danceroutine/tango-core', async () => {
    const actual = await vi.importActual<typeof import('@danceroutine/tango-core')>('@danceroutine/tango-core');
    return {
        ...actual,
        getLogger: vi.fn(() => ({
            error: vi.fn(),
            warn,
            info: vi.fn(),
            debug: vi.fn(),
        })),
    };
});

import { QueryResult } from '../QueryResult';

describe(QueryResult.name, () => {
    beforeEach(() => {
        warn.mockClear();
    });

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

    it('returns a mutable shallow copy from toArray', () => {
        const r = new QueryResult([{ id: 1 }]);
        const copy = r.toArray();
        copy.push({ id: 2 });
        expect(r.length).toBe(1);
    });

    it('serializes with toJSON', () => {
        const r = new QueryResult([{ id: 1 }], { nextCursor: 'abc' });
        expect(r.toJSON()).toEqual({ results: [{ id: 1 }], nextCursor: 'abc' });
    });

    it('exposes deprecated results with a single warning per process', () => {
        const r = new QueryResult([1, 2]);
        expect(r.results).toEqual([1, 2]);
        expect(r.results).toEqual([1, 2]);
        expect(warn).toHaveBeenCalledTimes(1);
    });
});
