import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { QuerySet } from '@danceroutine/tango-orm';
import { aQueryResult } from '../aQueryResult';
import { aQuerySet } from '../aQuerySet';

describe(aQuerySet, () => {
    it('returns chainable query doubles with optional overrides', async () => {
        type Model = { id: number };
        const filterOverride: QuerySet<Model>['filter'] = vi.fn(() => qs);
        const excludeOverride: QuerySet<Model>['exclude'] = vi.fn(() => qs);
        const orderByOverride: QuerySet<Model>['orderBy'] = vi.fn(() => qs);
        const limitOverride: QuerySet<Model>['limit'] = vi.fn(() => qs);
        const offsetOverride: QuerySet<Model>['offset'] = vi.fn(() => qs);
        const selectOverride: QuerySet<Model>['select'] = vi.fn(() => qs);
        const selectRelatedOverride: QuerySet<Model>['selectRelated'] = vi.fn(() => qs);
        const prefetchRelatedOverride: QuerySet<Model>['prefetchRelated'] = vi.fn(() => qs);
        const fetchOverride: QuerySet<Model>['fetch'] = async <Out = Model>() =>
            aQueryResult<Out>({ results: [{ id: 1 } as unknown as Out], nextCursor: 'next-cursor' });
        const fetchOneOverride: QuerySet<Model>['fetchOne'] = async <Out = Model>() => ({ id: 1 }) as Out;
        const countOverride: QuerySet<Model>['count'] = vi.fn(async () => 9);
        const existsOverride: QuerySet<Model>['exists'] = vi.fn(async () => true);

        const qs = aQuerySet<Model>({
            filter: filterOverride,
            exclude: excludeOverride,
            orderBy: orderByOverride,
            limit: limitOverride,
            offset: offsetOverride,
            select: selectOverride,
            selectRelated: selectRelatedOverride,
            prefetchRelated: prefetchRelatedOverride,
            fetch: fetchOverride,
            fetchOne: fetchOneOverride,
            count: countOverride,
            exists: existsOverride,
        });

        const chained = qs.filter({}).exclude({}).orderBy('id').limit(1).offset(0);
        expect(chained).toBe(qs);
        expect(qs.select(['id'])).toBe(qs);
        expect(qs.selectRelated('comments')).toBe(qs);
        expect(qs.prefetchRelated('comments')).toBe(qs);
        await expect(qs.fetch()).resolves.toMatchObject({ results: [{ id: 1 }], nextCursor: 'next-cursor' });
        await expect(qs.fetchOne()).resolves.toEqual({ id: 1 });
        await expect(qs.count()).resolves.toBe(9);
        await expect(qs.exists()).resolves.toBe(true);
    });

    it('uses default behaviors for fetch/fetchOne/count/exists', async () => {
        const qs = aQuerySet<{ id: number }>();
        expect(qs.filter({})).toBe(qs);
        expect(qs.exclude({})).toBe(qs);
        expect(qs.orderBy('id')).toBe(qs);
        expect(qs.limit(10)).toBe(qs);
        expect(qs.offset(5)).toBe(qs);
        expect(qs.select(['id'])).toBe(qs);
        expect(qs.selectRelated('comments')).toBe(qs);
        expect(qs.prefetchRelated('comments')).toBe(qs);
        await expect(qs.fetch()).resolves.toMatchObject({ results: [], nextCursor: null });
        await expect(qs.fetchOne()).resolves.toBeNull();
        await expect(qs.count()).resolves.toBe(0);
        await expect(qs.exists()).resolves.toBe(false);
    });

    it('supports explicit projected result typing for selected query doubles', async () => {
        type Model = { id: number; email: string };
        type Selected = Pick<Model, 'id'>;
        const qs = aQuerySet<Model, Selected>({
            fetch: async () => aQueryResult<Selected>({ results: [{ id: 1 }], nextCursor: null }),
            fetchOne: async () => ({ id: 1 }),
        });

        await expect(qs.fetch()).resolves.toMatchObject({ results: [{ id: 1 }], nextCursor: null });
        await expect(qs.fetchOne()).resolves.toEqual({ id: 1 });
        expectTypeOf(qs).toEqualTypeOf<QuerySet<Model, Selected>>();
    });
});
