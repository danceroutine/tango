import { describe, expect, expectTypeOf, it, vi } from 'vitest';
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

function createQueryExecutorFixture(rows: User[] = [], dialect: 'postgres' | 'sqlite' = 'postgres') {
    const run = vi.fn(async (_compiled: { sql: string; params: readonly unknown[] }) => rows);
    const query = vi.fn(async (_sql: string, _params?: readonly unknown[]) => ({ rows: [{ count: rows.length }] }));
    const queryExecutor = aQueryExecutor<User>({ meta, dialect, query, run });
    return { queryExecutor, run, query };
}

describe(QuerySet, () => {
    it('supports filter/exclude/order/limit/offset/select/selectRelated/prefetchRelated chaining', async () => {
        const { queryExecutor, run } = createQueryExecutorFixture([{ id: 1, email: 'a@a.com' } as User]);
        const qs = new QuerySet<User>(queryExecutor);

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

        expect(result.results).toEqual([{ id: 1, email: 'a@a.com' }]);
        expect(result.nextCursor).toBeNull();
        expect(run).toHaveBeenCalledOnce();
        expect(QuerySet.isQuerySet(qs)).toBe(true);
        expect(QuerySet.isQuerySet({})).toBe(false);
    });

    it('narrows fetched row types from literal select projections', async () => {
        const { queryExecutor } = createQueryExecutorFixture([{ id: 1, email: 'a@a.com', active: true }]);
        const qs = new QuerySet<User>(queryExecutor).select(['id', 'email'] as const);
        const result = await qs.fetch();

        expectTypeOf(qs).toEqualTypeOf<QuerySet<User, Pick<User, 'id' | 'email'>>>();
        expectTypeOf(result.results).toEqualTypeOf<Array<Pick<User, 'id' | 'email'>>>();
    });

    it('resets empty select projections back to the full row type', async () => {
        const { queryExecutor } = createQueryExecutorFixture([{ id: 1, email: 'a@a.com', active: true }]);
        const qs = new QuerySet<User>(queryExecutor).select([]);
        const result = await qs.fetch();

        expectTypeOf(qs).toEqualTypeOf<QuerySet<User>>();
        expectTypeOf(result.results).toEqualTypeOf<User[]>();
    });

    it('replaces prior projections when select is called again', async () => {
        const { queryExecutor } = createQueryExecutorFixture([{ id: 1, email: 'a@a.com', active: true }]);
        const qs = new QuerySet<User>(queryExecutor).select(['id'] as const).select(['email'] as const);
        const result = await qs.fetch();

        expectTypeOf(qs).toEqualTypeOf<QuerySet<User, Pick<User, 'email'>>>();
        expectTypeOf(result.results).toEqualTypeOf<Array<Pick<User, 'email'>>>();
    });

    it('falls back to the full row type for widened but key-safe select arrays', async () => {
        const cols: ReadonlyArray<keyof User> = ['id', 'email'];
        const { queryExecutor } = createQueryExecutorFixture([{ id: 1, email: 'a@a.com', active: true }]);
        const qs = new QuerySet<User>(queryExecutor).select(cols);
        const result = await qs.fetch();

        expectTypeOf(qs).toEqualTypeOf<QuerySet<User>>();
        expectTypeOf(result.results).toEqualTypeOf<User[]>();
    });

    it('rejects non-key select arrays at compile time', () => {
        const cols = ['id', 'email'] as string[];
        const qs = new QuerySet<User>(createQueryExecutorFixture().queryExecutor);

        // @ts-expect-error select only accepts keys from the model row
        qs.select(cols);
    });

    it('surfaces a meaningful compile error when a projected queryset is widened back to QuerySet<TModel>', () => {
        const projected = new QuerySet<User>(createQueryExecutorFixture().queryExecutor).select(['id'] as const);

        // @ts-expect-error projected querysets no longer satisfy QuerySet<TModel>
        const widened: QuerySet<User> = projected;

        expect(projected).toBeTruthy();
        void widened;
    });

    it('merges filters when chaining filter twice', async () => {
        const { queryExecutor, run } = createQueryExecutorFixture([{ id: 9, email: 'merge@a.com', active: true }]);
        const qs = new QuerySet<User>(queryExecutor).filter({ active: true }).filter({ email: 'merge@a.com' });
        await qs.fetch();
        const sql = run.mock.calls[0]?.[0]?.sql ?? '';
        expect(sql).toContain('AND');
    });

    it('accepts QNode filters and supports shape function/object in fetch', async () => {
        const { queryExecutor } = createQueryExecutorFixture([{ id: 2, email: 'b@a.com', active: false }]);
        const qs = new QuerySet<User>(queryExecutor)
            .filter(Q.or<User>({ id: 2 }, { email: 'x@x.com' }))
            .exclude(Q.not<User>({ email: 'blocked@example.com' }));

        const byFunction = await qs.fetch((row) => row.email);
        const byParser = await qs.fetch({ parse: (row) => ({ id: row.id }) });

        expect(byFunction.results).toEqual(['b@a.com']);
        expect(byParser.results).toEqual([{ id: 2 }]);
    });

    it('preserves narrowed result types when filtering and ordering after select', async () => {
        const { queryExecutor } = createQueryExecutorFixture([{ id: 2, email: 'b@a.com', active: false }]);
        const qs = new QuerySet<User>(queryExecutor)
            .select(['id'] as const)
            .filter({ email: 'b@a.com' })
            .orderBy('-email')
            .limit(1)
            .offset(0)
            .selectRelated('team')
            .prefetchRelated('posts');
        const result = await qs.fetch();

        expectTypeOf(qs).toEqualTypeOf<QuerySet<User, Pick<User, 'id'>>>();
        expectTypeOf(result.results).toEqualTypeOf<Array<Pick<User, 'id'>>>();
    });

    it('returns first row or null in fetchOne', async () => {
        const firstQueryExecutor = createQueryExecutorFixture([
            { id: 1, email: 'first@a.com', active: true },
        ]).queryExecutor;
        const emptyQueryExecutor = createQueryExecutorFixture([]).queryExecutor;

        expect(await new QuerySet<User>(firstQueryExecutor).fetchOne()).toEqual({
            id: 1,
            email: 'first@a.com',
            active: true,
        });
        expect(await new QuerySet<User>(emptyQueryExecutor).fetchOne()).toBeNull();
    });

    it('narrows fetchOne parser and shape inputs from the selected result type', async () => {
        const { queryExecutor } = createQueryExecutorFixture([{ id: 1, email: 'first@a.com', active: true }]);
        const selected = new QuerySet<User>(queryExecutor).select(['id'] as const);
        const parser = { parse: vi.fn((row: Pick<User, 'id'>) => row.id) };

        const byFunction = await selected.fetchOne((row) => row.id);
        const byParser = await selected.fetchOne(parser);

        expect(byFunction).toBe(1);
        expect(byParser).toBe(1);
        expect(parser.parse).toHaveBeenCalledWith({ id: 1, email: 'first@a.com', active: true });
    });

    it('counts and checks existence using compiled query params', async () => {
        const { queryExecutor, query } = createQueryExecutorFixture([{ id: 1, email: 'a@a.com', active: true }]);
        const qs = new QuerySet<User>(queryExecutor).filter({ active: true });

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
        const queryExecutor = aQueryExecutor<User>({ meta, query, run });

        const exists = await new QuerySet<User>(queryExecutor).exists();
        expect(exists).toBe(false);
    });

    it('normalizes sqlite bool columns before parser-based schema reads', async () => {
        const { queryExecutor } = createQueryExecutorFixture(
            [{ id: 4, email: 'bool@a.com', active: 1 as unknown as boolean }],
            'sqlite'
        );
        const parser = {
            parse: vi.fn((row: User) => row),
        };
        const result = await new QuerySet<User>(queryExecutor).fetch(parser);
        expect(result.results[0]?.active).toBe(true);
        expect(parser.parse).toHaveBeenCalledWith({ id: 4, email: 'bool@a.com', active: true });
    });

    it('leaves sqlite bool columns untouched for function-shape projections', async () => {
        const { queryExecutor } = createQueryExecutorFixture(
            [{ id: 5, email: 'func@a.com', active: 0 as unknown as boolean }],
            'sqlite'
        );
        const result = await new QuerySet<User>(queryExecutor).fetch((row) => row.active);
        expect(result.results).toEqual([0]);
    });

    it('normalizes sqlite bool zero values to false for parser-based schema reads', async () => {
        const { queryExecutor } = createQueryExecutorFixture(
            [{ id: 6, email: 'zero@a.com', active: 0 as unknown as boolean }],
            'sqlite'
        );
        const parser = {
            parse: vi.fn((row: User) => row),
        };
        const result = await new QuerySet<User>(queryExecutor).fetch(parser);
        expect(result.results[0]?.active).toBe(false);
        expect(parser.parse).toHaveBeenCalledWith({ id: 6, email: 'zero@a.com', active: false });
    });

    it('skips normalization when sqlite repositories have no boolean columns', async () => {
        const run = vi.fn(async () => [{ id: 7, email: 'nobool@a.com', active: 1 as unknown as boolean }]);
        const query = vi.fn(async () => ({ rows: [{ count: 1 }] }));
        const queryExecutor = aQueryExecutor<User>({
            meta: { ...meta, columns: { id: 'int', email: 'text', active: 'int' } },
            dialect: 'sqlite',
            query,
            run,
        });
        const parser = { parse: vi.fn((row: User) => row) };

        const result = await new QuerySet<User>(queryExecutor).fetch(parser);

        expect(result.results[0]?.active).toBe(1);
        expect(parser.parse).toHaveBeenCalledWith({ id: 7, email: 'nobool@a.com', active: 1 });
    });

    it('leaves non 0/1 sqlite bool values unchanged', async () => {
        const { queryExecutor } = createQueryExecutorFixture(
            [{ id: 8, email: 'other@a.com', active: 2 as unknown as boolean }],
            'sqlite'
        );
        const parser = { parse: vi.fn((row: User) => row) };
        const result = await new QuerySet<User>(queryExecutor).fetch(parser);
        expect(result.results[0]?.active).toBe(2);
        expect(parser.parse).toHaveBeenCalledWith({ id: 8, email: 'other@a.com', active: 2 });
    });

    it('skips sqlite boolean normalization for omitted projected columns', async () => {
        const { queryExecutor } = createQueryExecutorFixture([{ id: 10, email: 'skip@a.com' } as User], 'sqlite');
        const parser = {
            parse: vi.fn((row: Pick<User, 'id' | 'email'>) => row),
        };

        const result = await new QuerySet<User>(queryExecutor).select(['id', 'email'] as const).fetch(parser);

        expect(result.results[0]).toEqual({ id: 10, email: 'skip@a.com' });
        expect(parser.parse).toHaveBeenCalledWith({ id: 10, email: 'skip@a.com' });
    });

    it('normalizes multiple sqlite boolean columns in a single row', async () => {
        const run = vi.fn(async () => [
            { id: 9, email: 'multi@a.com', active: 1 as unknown as boolean, verified: 0 as unknown as boolean },
        ]);
        const query = vi.fn(async () => ({ rows: [{ count: 1 }] }));
        const queryExecutor = aQueryExecutor<MultiBoolUser>({
            meta: { ...meta, columns: { ...meta.columns, verified: 'bool' } },
            dialect: 'sqlite',
            query,
            run,
        });
        const parser = { parse: vi.fn((row: MultiBoolUser) => row) };

        const result = await new QuerySet<MultiBoolUser>(queryExecutor).fetch(parser);

        expect(result.results[0]).toEqual({ id: 9, email: 'multi@a.com', active: true, verified: false });
        expect(parser.parse).toHaveBeenCalledWith({ id: 9, email: 'multi@a.com', active: true, verified: false });
    });
});
