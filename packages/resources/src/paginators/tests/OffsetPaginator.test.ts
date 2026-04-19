import { describe, it, expect, vi } from 'vitest';
import { TangoQueryParams } from '@danceroutine/tango-core';
import { OffsetPaginator } from '../OffsetPaginator';
import { aQueryResult, aQuerySet } from '@danceroutine/tango-testing';

function query(input: string = ''): TangoQueryParams {
    return TangoQueryParams.fromURLSearchParams(new URLSearchParams(input));
}

describe(OffsetPaginator, () => {
    describe(OffsetPaginator.prototype.parseParams, () => {
        const dummyQueryset = aQuerySet<Record<string, unknown>>();

        it('parses default pagination', () => {
            const paginator = new OffsetPaginator(dummyQueryset);
            const params = query();
            const result = paginator.parseParams(params);

            expect(result.limit).toBe(25);
            expect(result.offset).toBe(0);
        });

        it('parses limit and offset', () => {
            const paginator = new OffsetPaginator(dummyQueryset);
            const params = query('limit=10&offset=20');
            const result = paginator.parseParams(params);

            expect(result.limit).toBe(10);
            expect(result.offset).toBe(20);
        });

        it('converts page to offset', () => {
            const paginator = new OffsetPaginator(dummyQueryset);
            const params = query('page=3&limit=10');
            const result = paginator.parseParams(params);

            expect(result.offset).toBe(20);
        });

        it('enforces max limit', () => {
            const paginator = new OffsetPaginator(dummyQueryset);
            const params = query('limit=1000');
            const result = paginator.parseParams(params);

            expect(result.limit).toBe(100);
        });
    });

    describe(OffsetPaginator.prototype.getPaginatedResponse, () => {
        const dummyQueryset = aQuerySet<Record<string, unknown>>();

        it('creates basic paginated response', () => {
            const paginator = new OffsetPaginator(dummyQueryset);
            paginator.parseParams(query());
            const results = [{ id: 1 }, { id: 2 }];

            const response = paginator.getPaginatedResponse(results);

            expect(response.results).toEqual(results);
            expect(response.count).toBeUndefined();
        });

        it('includes next link when more results exist', () => {
            const paginator = new OffsetPaginator(dummyQueryset);
            paginator.parseParams(query('limit=1&offset=0'));
            const results = [{ id: 1 }];

            const response = paginator.getPaginatedResponse(results, 10);

            expect(response.count).toBe(10);
            expect(response.next).toBe('?limit=1&offset=1');
        });

        it('preserves unrelated query params when provided the current TangoQueryParams', () => {
            const paginator = new OffsetPaginator(dummyQueryset);
            const params = query('limit=1&offset=0&search=tango');
            paginator.parseParams(params);

            const response = paginator.getPaginatedResponse([{ id: 1 }], 10, params);

            expect(response.next).toBe('?limit=1&offset=1&search=tango');
        });

        it('drops page when preserving query params for next and previous links', () => {
            const paginator = new OffsetPaginator(dummyQueryset);
            const params = query('page=3&limit=5&search=tango');
            paginator.parseParams(params);

            const response = paginator.getPaginatedResponse([{ id: 11 }], 30, params);

            expect(response.next).toBe('?limit=5&search=tango&offset=15');
            expect(response.previous).toBe('?limit=5&search=tango&offset=5');
        });

        it('includes previous link when offset > 0', () => {
            const paginator = new OffsetPaginator(dummyQueryset);
            paginator.parseParams(query('limit=1&offset=5'));
            const results = [{ id: 1 }];

            const response = paginator.getPaginatedResponse(results, 10);

            expect(response.previous).toBe('?limit=1&offset=4');
        });

        it('does not include next when no more results', () => {
            const paginator = new OffsetPaginator(dummyQueryset);
            paginator.parseParams(query('limit=10&offset=0'));
            const results = [{ id: 1 }];

            const response = paginator.getPaginatedResponse(results, 1);

            expect(response.next).toBeUndefined();
        });
    });

    describe('helpers and typeguards', () => {
        it('identifies matching instances', () => {
            const paginator = new OffsetPaginator(aQuerySet<Record<string, unknown>>());
            expect(OffsetPaginator.isOffsetPaginator(paginator)).toBe(true);
            expect(OffsetPaginator.isOffsetPaginator({})).toBe(false);
        });

        it('returns the first page through paginate', async () => {
            const paginator = new OffsetPaginator(aQuerySet<Record<string, unknown>>());
            const spy = vi.spyOn(paginator, 'getPage').mockResolvedValue({
                results: [],
                hasNext: () => false,
                hasPrevious: () => false,
                nextPageNumber: () => null,
                previousPageNumber: () => null,
                startIndex: () => 0,
                endIndex: () => 0,
            });

            await paginator.paginate(3);
            expect(spy).toHaveBeenCalledWith(3);
        });

        it('getPage computes offsets and exposes page helpers', async () => {
            const qs = aQuerySet<Record<string, unknown>>({
                fetch: vi.fn().mockResolvedValue(
                    aQueryResult({ items: [{ id: 3 }, { id: 4 }] })
                ),
                count: vi.fn().mockResolvedValue(5),
            });
            qs.offset = vi.fn().mockReturnValue(qs);
            qs.limit = vi.fn().mockReturnValue(qs);
            const paginator = new OffsetPaginator(qs, 2);

            const page = await paginator.getPage(2);

            expect(qs.offset).toHaveBeenCalledWith(2);
            expect(qs.limit).toHaveBeenCalledWith(2);
            expect(page.startIndex()).toBe(2);
            expect(page.endIndex()).toBe(4);
            expect(page.hasPrevious()).toBe(true);
            expect(page.previousPageNumber()).toBe(1);
            expect(page.hasNext()).toBe(true);
            expect(page.nextPageNumber()).toBe(3);

            const ctor = Object.getPrototypeOf(page).constructor as { isOffsetPage: (value: unknown) => boolean };
            expect(ctor.isOffsetPage(page)).toBe(true);
            expect(ctor.isOffsetPage({})).toBe(false);
        });

        it('returns the queryset count', async () => {
            const qs = aQuerySet<Record<string, unknown>>({
                count: vi.fn().mockResolvedValue(12),
            });
            const paginator = new OffsetPaginator(qs);
            await expect(paginator.count()).resolves.toBe(12);
        });

        it('treats pages with undefined total count as not having next page', async () => {
            const qs = aQuerySet<Record<string, unknown>>({
                fetch: vi.fn().mockResolvedValue(aQueryResult({ items: [{ id: 1 }] })),
                count: vi.fn().mockResolvedValue(undefined),
            });
            qs.offset = vi.fn().mockReturnValue(qs);
            qs.limit = vi.fn().mockReturnValue(qs);
            const paginator = new OffsetPaginator(qs, 1);

            const page = await paginator.getPage(1);
            expect(page.hasNext()).toBe(false);
            expect(page.nextPageNumber()).toBeNull();
            expect(page.previousPageNumber()).toBeNull();
        });
    });
});
