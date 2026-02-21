import { describe, expect, it, vi } from 'vitest';
import { aQueryExecutor } from '@danceroutine/tango-testing';
import { QuerySet } from '../QuerySet';
import { QBuilder as Q } from '../QBuilder';
import type { TableMeta } from '../domain/TableMeta';

type User = {
    id: number;
    email: string;
    active: boolean;
};

type MultiBoolUser = User & {
    verified: boolean;
};

const meta: TableMeta = {
    table: 'users',
    pk: 'id',
    columns: {
        id: 'int',
        email: 'text',
        active: 'bool',
    },
};

function createRepo(rows: User[] = [], dialect: 'postgres' | 'sqlite' = 'postgres') {
    const run = vi.fn(async (_compiled: { sql: string; params: readonly unknown[] }) => rows);
    const query = vi.fn(async (_sql: string, _params?: readonly unknown[]) => ({ rows: [{ count: rows.length }] }));
    const repo = aQueryExecutor<User>({ meta, dialect, query, run });
    return { repo, run, query };
}

describe(QuerySet, () => {
    it('supports filter/exclude/order/limit/offset/select/selectRelated/prefetchRelated chaining', async () => {
        const { repo, run } = createRepo([{ id: 1, email: 'a@a.com', active: true }]);
        const qs = new QuerySet<User>(repo);

        const result = await qs
            .filter({ active: true })
            .exclude({ email__contains: 'spam' })
            .orderBy('-id', 'email')
            .limit(10)
            .offset(20)
            .select(['id', 'email'])
            .selectRelated('team')
            .prefetchRelated('posts')
            .fetch();

        expect(result.results).toEqual([{ id: 1, email: 'a@a.com', active: true }]);
        expect(result.nextCursor).toBeNull();
        expect(run).toHaveBeenCalledOnce();
        expect(QuerySet.isQuerySet(qs)).toBe(true);
        expect(QuerySet.isQuerySet({})).toBe(false);
    });

    it('merges filters when chaining filter twice', async () => {
        const { repo, run } = createRepo([{ id: 9, email: 'merge@a.com', active: true }]);
        const qs = new QuerySet<User>(repo).filter({ active: true }).filter({ email: 'merge@a.com' });
        await qs.fetch();
        const sql = run.mock.calls[0]?.[0]?.sql ?? '';
        expect(sql).toContain('AND');
    });

    it('accepts QNode filters and supports shape function/object in fetch', async () => {
        const { repo } = createRepo([{ id: 2, email: 'b@a.com', active: false }]);
        const qs = new QuerySet<User>(repo)
            .filter(Q.or<User>({ id: 2 }, { email: 'x@x.com' }))
            .exclude(Q.not<User>({ email: 'blocked@example.com' }));

        const byFunction = await qs.fetch((row) => row.email);
        const byParser = await qs.fetch({ parse: (row) => ({ id: row.id }) });

        expect(byFunction.results).toEqual(['b@a.com']);
        expect(byParser.results).toEqual([{ id: 2 }]);
    });

    it('returns first row or null in fetchOne', async () => {
        const firstRepo = createRepo([{ id: 1, email: 'first@a.com', active: true }]).repo;
        const emptyRepo = createRepo([]).repo;

        expect(await new QuerySet<User>(firstRepo).fetchOne()).toEqual({ id: 1, email: 'first@a.com', active: true });
        expect(await new QuerySet<User>(emptyRepo).fetchOne()).toBeNull();
    });

    it('counts and checks existence using compiled query params', async () => {
        const { repo, query } = createRepo([{ id: 1, email: 'a@a.com', active: true }]);
        const qs = new QuerySet<User>(repo).filter({ active: true });

        const count = await qs.count();
        const exists = await qs.exists();

        expect(count).toBe(1);
        expect(exists).toBe(true);
        expect(query).toHaveBeenCalledTimes(2);
        expect(query.mock.calls[0]?.[0]).toContain('SELECT COUNT(*) as count FROM');
    });

    it('returns false from exists when count is zero', async () => {
        const run = vi.fn(async () => [] as User[]);
        const query = vi.fn(async () => ({ rows: [] as Array<{ count: number }> }));
        const repo = aQueryExecutor<User>({ meta, query, run });

        const exists = await new QuerySet<User>(repo).exists();
        expect(exists).toBe(false);
    });

    it('normalizes sqlite bool columns before parser-based schema reads', async () => {
        const { repo } = createRepo([{ id: 4, email: 'bool@a.com', active: 1 as unknown as boolean }], 'sqlite');
        const parser = {
            parse: vi.fn((row: User) => row),
        };
        const result = await new QuerySet<User>(repo).fetch(parser);
        expect(result.results[0]?.active).toBe(true);
        expect(parser.parse).toHaveBeenCalledWith({ id: 4, email: 'bool@a.com', active: true });
    });

    it('leaves sqlite bool columns untouched for function-shape projections', async () => {
        const { repo } = createRepo([{ id: 5, email: 'func@a.com', active: 0 as unknown as boolean }], 'sqlite');
        const result = await new QuerySet<User>(repo).fetch((row) => row.active);
        expect(result.results).toEqual([0]);
    });

    it('normalizes sqlite bool zero values to false for parser-based schema reads', async () => {
        const { repo } = createRepo([{ id: 6, email: 'zero@a.com', active: 0 as unknown as boolean }], 'sqlite');
        const parser = {
            parse: vi.fn((row: User) => row),
        };
        const result = await new QuerySet<User>(repo).fetch(parser);
        expect(result.results[0]?.active).toBe(false);
        expect(parser.parse).toHaveBeenCalledWith({ id: 6, email: 'zero@a.com', active: false });
    });

    it('skips normalization when sqlite repositories have no boolean columns', async () => {
        const run = vi.fn(async () => [{ id: 7, email: 'nobool@a.com', active: 1 as unknown as boolean }]);
        const query = vi.fn(async () => ({ rows: [{ count: 1 }] }));
        const repo = aQueryExecutor<User>({
            meta: { ...meta, columns: { id: 'int', email: 'text', active: 'int' } },
            dialect: 'sqlite',
            query,
            run,
        });
        const parser = { parse: vi.fn((row: User) => row) };

        const result = await new QuerySet<User>(repo).fetch(parser);

        expect(result.results[0]?.active).toBe(1);
        expect(parser.parse).toHaveBeenCalledWith({ id: 7, email: 'nobool@a.com', active: 1 });
    });

    it('leaves non 0/1 sqlite bool values unchanged', async () => {
        const { repo } = createRepo([{ id: 8, email: 'other@a.com', active: 2 as unknown as boolean }], 'sqlite');
        const parser = { parse: vi.fn((row: User) => row) };
        const result = await new QuerySet<User>(repo).fetch(parser);
        expect(result.results[0]?.active).toBe(2);
        expect(parser.parse).toHaveBeenCalledWith({ id: 8, email: 'other@a.com', active: 2 });
    });

    it('normalizes multiple sqlite boolean columns in a single row', async () => {
        const run = vi.fn(async () => [
            { id: 9, email: 'multi@a.com', active: 1 as unknown as boolean, verified: 0 as unknown as boolean },
        ]);
        const query = vi.fn(async () => ({ rows: [{ count: 1 }] }));
        const repo = aQueryExecutor<MultiBoolUser>({
            meta: { ...meta, columns: { ...meta.columns, verified: 'bool' } },
            dialect: 'sqlite',
            query,
            run,
        });
        const parser = { parse: vi.fn((row: MultiBoolUser) => row) };

        const result = await new QuerySet<MultiBoolUser>(repo).fetch(parser);

        expect(result.results[0]).toEqual({ id: 9, email: 'multi@a.com', active: true, verified: false });
        expect(parser.parse).toHaveBeenCalledWith({ id: 9, email: 'multi@a.com', active: true, verified: false });
    });
});
