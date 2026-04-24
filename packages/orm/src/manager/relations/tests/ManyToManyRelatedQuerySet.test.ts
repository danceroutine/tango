import { describe, expect, it, vi } from 'vitest';
import { aQueryExecutor } from '@danceroutine/tango-testing';
import type { TableMeta } from '../../../query/domain/index';
import { ManyToManyRelatedQuerySet, type ManyToManyRelatedQuerySetBridge } from '../ManyToManyRelatedQuerySet';

interface TagRow extends Record<string, unknown> {
    id: number;
    name: string;
}

const targetMeta: TableMeta = {
    table: 'tags',
    pk: 'id',
    columns: { id: 'int', name: 'text' },
};

function buildBridge(
    overrides: Partial<ManyToManyRelatedQuerySetBridge<TagRow>> = {}
): ManyToManyRelatedQuerySetBridge<TagRow> {
    return {
        getCache: () => null,
        fetchTargetIds: async () => [],
        targetPrimaryKeyField: 'id',
        ...overrides,
    };
}

describe(ManyToManyRelatedQuerySet, () => {
    it('returns the prefetch cache directly when no chained operations were applied', async () => {
        const cache: TagRow[] = [
            { id: 1, name: 'docs' },
            { id: 2, name: 'guides' },
        ];
        const run = vi.fn();
        const executor = aQueryExecutor<TagRow>({ meta: targetMeta, run });
        const queryset = new ManyToManyRelatedQuerySet<TagRow>(executor, buildBridge({ getCache: () => cache }));

        const result = await queryset.fetch();

        expect(result.results).toEqual(cache);
        expect(result.results).not.toBe(cache);
        expect(run).not.toHaveBeenCalled();
    });

    it('applies the supplied shape to cached rows', async () => {
        const cache: TagRow[] = [{ id: 1, name: 'docs' }];
        const executor = aQueryExecutor<TagRow>({ meta: targetMeta });
        const queryset = new ManyToManyRelatedQuerySet<TagRow>(executor, buildBridge({ getCache: () => cache }));

        const namesViaFunction = await queryset.fetch((row) => row.name);
        expect(namesViaFunction.results).toEqual(['docs']);

        const namesViaParser = await queryset.fetch({ parse: (row: TagRow) => row.name });
        expect(namesViaParser.results).toEqual(['docs']);
    });

    it('returns an empty result without hitting the executor when the through table yields no targets', async () => {
        const run = vi.fn();
        const executor = aQueryExecutor<TagRow>({ meta: targetMeta, run });
        const queryset = new ManyToManyRelatedQuerySet<TagRow>(
            executor,
            buildBridge({ fetchTargetIds: async () => [] })
        );

        const result = await queryset.fetch();

        expect(result.results).toEqual([]);
        expect(run).not.toHaveBeenCalled();
    });

    it('scopes follow-up queries to the resolved owner target ids when state is non-trivial', async () => {
        const rows: TagRow[] = [
            { id: 10, name: 'docs' },
            { id: 11, name: 'guides' },
        ];
        const run = vi.fn().mockResolvedValue(rows);
        const executor = aQueryExecutor<TagRow>({ meta: targetMeta, run });
        const queryset = new ManyToManyRelatedQuerySet<TagRow>(
            executor,
            buildBridge({
                fetchTargetIds: async () => [10, 11],
                getCache: () => [{ id: 1, name: 'stale' }],
            })
        );

        const result = await queryset.filter({ name: 'docs' }).fetch();

        expect(result.results).toEqual(rows);
        expect(run).toHaveBeenCalledTimes(1);
        const compiled = run.mock.calls[0]![0];
        expect(compiled.sql).toMatch(/IN/);
        expect(compiled.params).toEqual(expect.arrayContaining([10, 11, 'docs']));
    });

    it('preserves owner scoping when select narrows the target projection', async () => {
        const rows = [{ id: 10 }];
        const run = vi.fn().mockResolvedValue(rows);
        const executor = aQueryExecutor<TagRow>({ meta: targetMeta, run });
        const queryset = new ManyToManyRelatedQuerySet<TagRow>(
            executor,
            buildBridge({
                fetchTargetIds: async () => [10, 11],
            })
        );

        const result = await queryset.select(['id'] as const).fetch();

        expect(result.results).toEqual(rows);
        expect(run).toHaveBeenCalledTimes(1);
        const compiled = run.mock.calls[0]![0];
        expect(compiled.sql).toMatch(/SELECT tags\.id FROM tags/);
        expect(compiled.params).toEqual([10, 11]);
    });

    it('drops the cache after exclude / orderBy / limit / offset chains', async () => {
        const run = vi.fn().mockResolvedValue([]);
        const executor = aQueryExecutor<TagRow>({ meta: targetMeta, run });
        const queryset = new ManyToManyRelatedQuerySet<TagRow>(
            executor,
            buildBridge({
                getCache: () => [{ id: 1, name: 'docs' }],
                fetchTargetIds: async () => [1],
            })
        );

        await queryset.exclude({ name: 'docs' }).fetch();
        await queryset.orderBy('name').fetch();
        await queryset.limit(2).fetch();
        await queryset.offset(1).fetch();

        expect(run).toHaveBeenCalledTimes(4);
    });

    it('supports fetchOne returning the first cached row or null when empty', async () => {
        const cache: TagRow[] = [{ id: 1, name: 'docs' }];
        const executor = aQueryExecutor<TagRow>({ meta: targetMeta });

        const populated = new ManyToManyRelatedQuerySet<TagRow>(executor, buildBridge({ getCache: () => cache }));
        await expect(populated.fetchOne()).resolves.toEqual(cache[0]);
        await expect(populated.fetchOne((row) => row.name)).resolves.toBe('docs');

        const empty = new ManyToManyRelatedQuerySet<TagRow>(executor, buildBridge({ getCache: () => [] }));
        await expect(empty.fetchOne()).resolves.toBeNull();
    });

    it('returns the through-table id count without compiling a count query when state is trivial', async () => {
        const query = vi.fn();
        const linked = new ManyToManyRelatedQuerySet<TagRow>(
            aQueryExecutor<TagRow>({ meta: targetMeta, query }),
            buildBridge({ fetchTargetIds: async () => [10, 11] })
        );

        await expect(linked.count()).resolves.toBe(2);
        await expect(linked.exists()).resolves.toBe(true);
        expect(query).not.toHaveBeenCalled();
    });

    it('returns zero from count and false from exists when no targets are linked', async () => {
        const empty = new ManyToManyRelatedQuerySet<TagRow>(
            aQueryExecutor<TagRow>({ meta: targetMeta }),
            buildBridge({ fetchTargetIds: async () => [] })
        );
        await expect(empty.count()).resolves.toBe(0);
        await expect(empty.exists()).resolves.toBe(false);
    });

    it('short-circuits count and exists to the prefetch cache when state is trivial', async () => {
        const fetchTargetIds = vi.fn(async () => [1, 2]);
        const queryset = new ManyToManyRelatedQuerySet<TagRow>(
            aQueryExecutor<TagRow>({ meta: targetMeta }),
            buildBridge({
                fetchTargetIds,
                getCache: () => [
                    { id: 1, name: 'a' },
                    { id: 2, name: 'b' },
                    { id: 3, name: 'c' },
                ],
            })
        );

        await expect(queryset.count()).resolves.toBe(3);
        await expect(queryset.exists()).resolves.toBe(true);
        expect(fetchTargetIds).not.toHaveBeenCalled();
    });

    it('delegates to a scoped COUNT query when state is non-trivial', async () => {
        const query = vi.fn(async (sql: string, _params?: readonly unknown[]) => {
            if (sql.startsWith('SELECT COUNT')) {
                return { rows: [{ count: 5 }] };
            }
            return { rows: [] as Record<string, unknown>[] };
        });
        const queryset = new ManyToManyRelatedQuerySet<TagRow>(
            aQueryExecutor<TagRow>({ meta: targetMeta, query }),
            buildBridge({ fetchTargetIds: async () => [10, 11] })
        );

        await expect(queryset.filter({ name: 'docs' }).count()).resolves.toBe(5);
        expect(query).toHaveBeenCalledTimes(1);
        const [sql, params] = query.mock.calls[0]!;
        expect(sql).toMatch(/SELECT COUNT/);
        expect(params).toEqual(expect.arrayContaining([10, 11, 'docs']));
    });

    it('combines successive filter calls into a conjunctive predicate', async () => {
        const run = vi.fn().mockResolvedValue([]);
        const executor = aQueryExecutor<TagRow>({ meta: targetMeta, run });
        const queryset = new ManyToManyRelatedQuerySet<TagRow>(
            executor,
            buildBridge({ fetchTargetIds: async () => [10] })
        );

        await queryset.filter({ name: 'docs' }).filter({ id: 10 }).fetch();

        expect(run).toHaveBeenCalledTimes(1);
        const compiled = run.mock.calls[0]![0];
        expect(compiled.params).toEqual(expect.arrayContaining([10, 'docs']));
    });

    it('applies the supplied shape when fetching uncached results from the executor', async () => {
        const run = vi.fn().mockResolvedValue([{ id: 10, name: 'docs' }]);
        const executor = aQueryExecutor<TagRow>({ meta: targetMeta, run });
        const queryset = new ManyToManyRelatedQuerySet<TagRow>(
            executor,
            buildBridge({ fetchTargetIds: async () => [10] })
        );

        const result = await queryset.fetch((row) => row.name);
        expect(result.results).toEqual(['docs']);
    });

    it('forwards pre-built QNode predicates through filter and exclude', async () => {
        const run = vi.fn().mockResolvedValue([]);
        const executor = aQueryExecutor<TagRow>({ meta: targetMeta, run });
        const queryset = new ManyToManyRelatedQuerySet<TagRow>(
            executor,
            buildBridge({ fetchTargetIds: async () => [10] })
        );

        const filtered = queryset.filter({ kind: 'atom', where: { name: 'docs' } });
        const excluded = filtered.exclude({ kind: 'atom', where: { name: 'spam' } });
        await excluded.fetch();

        expect(run).toHaveBeenCalledTimes(1);
        const compiled = run.mock.calls[0]![0];
        expect(compiled.params).toEqual(expect.arrayContaining([10, 'docs', 'spam']));
    });
});
