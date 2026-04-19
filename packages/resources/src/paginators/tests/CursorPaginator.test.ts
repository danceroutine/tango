import { describe, it, expect, vi } from 'vitest';
import { TangoQueryParams } from '@danceroutine/tango-core';
import { CursorPaginator } from '../CursorPaginator';
import type { QuerySet } from '@danceroutine/tango-orm';
import { aQueryResult, aQuerySet } from '@danceroutine/tango-testing';

function query(input: string = ''): TangoQueryParams {
    return TangoQueryParams.fromURLSearchParams(new URLSearchParams(input));
}

describe(CursorPaginator, () => {
    const makeQuerySet = (results: Array<Record<string, unknown>>) => {
        const qs = aQuerySet<Record<string, unknown>>({
            fetch: vi.fn().mockResolvedValue(aQueryResult({ items: results })),
            count: vi.fn().mockResolvedValue(results.length),
        });

        qs.limit = vi.fn().mockReturnValue(qs);
        qs.filter = vi.fn().mockReturnValue(qs);
        qs.orderBy = vi.fn().mockReturnValue(qs);

        return qs;
    };

    it('parses limit and defaults offset to 0', () => {
        const paginator = new CursorPaginator(makeQuerySet([]) as unknown as QuerySet<Record<string, unknown>>);
        const parsed = paginator.parseParams(query('limit=10'));
        expect(parsed).toEqual({ limit: 10, offset: 0 });
    });

    it('uses default per-page when limit is omitted', () => {
        const paginator = new CursorPaginator(makeQuerySet([]) as unknown as QuerySet<Record<string, unknown>>, 9);
        const parsed = paginator.parseParams(query());
        expect(parsed).toEqual({ limit: 9, offset: 0 });
    });

    it('identifies matching instances', () => {
        const paginator = new CursorPaginator(makeQuerySet([]) as unknown as QuerySet<Record<string, unknown>>);
        expect(CursorPaginator.isCursorPaginator(paginator)).toBe(true);
        expect(CursorPaginator.isCursorPaginator({})).toBe(false);
    });

    it('enforces max limit', () => {
        const paginator = new CursorPaginator(makeQuerySet([]) as unknown as QuerySet<Record<string, unknown>>);
        const parsed = paginator.parseParams(query('limit=9999'));
        expect(parsed.limit).toBe(100);
    });

    it('falls back to per-page limit and asc direction when parse input is invalid or mismatched', () => {
        const paginator = new CursorPaginator(
            makeQuerySet([]) as unknown as QuerySet<Record<string, unknown>>,
            7,
            'id'
        );
        const parsed = paginator.parseParams(query('limit=bad&ordering=-createdAt'));
        expect(parsed).toEqual({ limit: 7, offset: 0 });
    });

    it('generates next cursor when limit+1 records are fetched', async () => {
        const qs = makeQuerySet([{ id: 1 }, { id: 2 }, { id: 3 }]);
        const paginator = new CursorPaginator(qs as unknown as QuerySet<Record<string, unknown>>, 2, 'id');
        paginator.parseParams(query('limit=2'));

        const page = await paginator.paginate();
        expect(page.results).toEqual([{ id: 1 }, { id: 2 }]);
        expect(page.hasNext()).toBe(true);
        expect(page.hasPrevious()).toBe(false);
        expect(page.nextPageNumber()).toBeNull();
        expect(page.previousPageNumber()).toBeNull();
        expect(page.startIndex()).toBe(0);
        expect(page.endIndex()).toBe(2);

        const response = paginator.getPaginatedResponse(page.results);
        expect(response.next).toContain('cursor=');
        expect(response.next).toContain('ordering=id');
    });

    it('includes previous link when cursor is provided', async () => {
        const seeded = new CursorPaginator(
            makeQuerySet([{ id: 1 }, { id: 2 }, { id: 3 }]) as unknown as QuerySet<Record<string, unknown>>,
            2,
            'id'
        );
        seeded.parseParams(query('limit=2'));
        const seededPage = await seeded.paginate();
        const next = seeded.getPaginatedResponse(seededPage.results).next!;
        const cursor = new URLSearchParams(next.slice(1)).get('cursor')!;

        const paginator = new CursorPaginator(
            makeQuerySet([{ id: 2 }, { id: 3 }]) as unknown as QuerySet<Record<string, unknown>>,
            2,
            'id'
        );
        paginator.parseParams(query('limit=2'));
        const page = await paginator.paginate(cursor);
        const response = paginator.getPaginatedResponse(page.results);

        expect(response.previous).toContain('cursor=');
    });

    it('applies gt lookup for ascending cursor pagination', async () => {
        const qs = makeQuerySet([{ id: 2 }, { id: 3 }]);
        const paginator = new CursorPaginator(qs as unknown as QuerySet<Record<string, unknown>>, 2, 'id');

        const seeded = new CursorPaginator(
            makeQuerySet([{ id: 1 }, { id: 2 }, { id: 3 }]) as unknown as QuerySet<Record<string, unknown>>,
            2,
            'id'
        );
        seeded.parseParams(query('limit=2'));
        const seededPage = await seeded.paginate();
        const next = seeded.getPaginatedResponse(seededPage.results).next!;
        const cursor = new URLSearchParams(next.slice(1)).get('cursor')!;

        paginator.parseParams(query('limit=2&ordering=id'));
        await paginator.paginate(cursor);

        expect(vi.mocked(qs.filter).mock.calls[0]?.[0]).toMatchObject({ id__gt: 2 });
    });

    it('applies lt lookup for descending cursor pagination', async () => {
        const qs = makeQuerySet([{ id: 3 }, { id: 2 }]);
        const paginator = new CursorPaginator(qs as unknown as QuerySet<Record<string, unknown>>, 2, 'id');

        const seeded = new CursorPaginator(
            makeQuerySet([{ id: 5 }, { id: 4 }, { id: 3 }]) as unknown as QuerySet<Record<string, unknown>>,
            2,
            'id'
        );
        seeded.parseParams(query('limit=2&ordering=-id'));
        const seededPage = await seeded.paginate();
        const next = seeded.getPaginatedResponse(seededPage.results).next!;
        const cursor = new URLSearchParams(next.slice(1)).get('cursor')!;

        paginator.parseParams(query('limit=2&ordering=-id'));
        await paginator.paginate(cursor);

        expect(vi.mocked(qs.filter).mock.calls[0]?.[0]).toMatchObject({ id__lt: 4 });
    });

    it('throws on malformed cursor', async () => {
        const paginator = new CursorPaginator(
            makeQuerySet([{ id: 1 }]) as unknown as QuerySet<Record<string, unknown>>,
            2,
            'id'
        );
        paginator.parseParams(query('limit=2'));
        await expect(paginator.paginate('not-base64')).rejects.toThrow('Invalid cursor');
    });

    it('throws on unsupported cursor payload', async () => {
        const paginator = new CursorPaginator(
            makeQuerySet([{ id: 1 }]) as unknown as QuerySet<Record<string, unknown>>,
            2,
            'id'
        );
        paginator.parseParams(query('limit=2'));
        const invalidPayload = Buffer.from(
            JSON.stringify({ v: 2, field: 'id', dir: 'asc', value: 1 }),
            'utf-8'
        ).toString('base64');
        await expect(paginator.paginate(invalidPayload)).rejects.toThrow('Invalid cursor: unsupported payload');
    });

    it('getPage only allows first page', async () => {
        const paginator = new CursorPaginator(
            makeQuerySet([{ id: 1 }]) as unknown as QuerySet<Record<string, unknown>>,
            2,
            'id'
        );
        await expect(paginator.getPage(2)).rejects.toThrow('CursorPaginator only supports getPage(1)');
    });

    it('returns the first cursor page through getPage(1)', async () => {
        const paginator = new CursorPaginator(
            makeQuerySet([{ id: 1 }]) as unknown as QuerySet<Record<string, unknown>>,
            2,
            'id'
        );
        const spy = vi.spyOn(paginator, 'paginate');
        await paginator.getPage(1);
        expect(spy).toHaveBeenCalled();
    });

    it('throws when cursor field does not match configured cursorField', async () => {
        const paginator = new CursorPaginator(
            makeQuerySet([{ id: 1 }]) as unknown as QuerySet<Record<string, unknown>>,
            2,
            'id'
        );
        paginator.parseParams(query('limit=2'));
        const badCursor = Buffer.from(JSON.stringify({ v: 1, field: 'other', dir: 'asc', value: 1 }), 'utf-8').toString(
            'base64'
        );
        await expect(paginator.paginate(badCursor)).rejects.toThrow('Invalid cursor: field mismatch');
    });

    it('identifies cursor page objects', async () => {
        const paginator = new CursorPaginator(
            makeQuerySet([{ id: 1 }, { id: 2 }, { id: 3 }]) as unknown as QuerySet<Record<string, unknown>>,
            2,
            'id'
        );
        paginator.parseParams(query('limit=2'));
        const page = await paginator.paginate();
        const ctor = Object.getPrototypeOf(page).constructor as {
            isCursorPage: (value: unknown) => boolean;
        };
        expect(ctor.isCursorPage(page)).toBe(true);
        expect(ctor.isCursorPage({})).toBe(false);
    });
});
