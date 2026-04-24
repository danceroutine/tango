import { describe, expect, it, vi } from 'vitest';
import { aQueryExecutor } from '../aQueryExecutor';

describe(aQueryExecutor, () => {
    it('creates a minimal repository-like test double with defaults', async () => {
        const repository = aQueryExecutor<{ id: string }>();

        expect(repository.adapter.dialect).toBe('postgres');
        expect(repository.meta).toEqual({ table: 'mock_table', pk: 'id', columns: {} });
        expect(await repository.run({ sql: 'select 1', params: [] })).toEqual([]);
        await repository.client.query('select 1');
        expect(vi.mocked(repository.client.query)).toHaveBeenCalledWith('select 1');
    });

    it('applies overrides for dialect, meta, run, and query', async () => {
        const run = vi.fn(async () => [{ id: '1' }]);
        const query = vi.fn(async () => ({ rows: [{ id: '1' }] }));
        const repository = aQueryExecutor<{ id: string }>({
            dialect: 'sqlite',
            meta: { table: 'users', pk: 'id', columns: { id: 'text' } },
            run,
            query,
        });

        expect(repository.adapter.dialect).toBe('sqlite');
        expect(repository.meta).toEqual({ table: 'users', pk: 'id', columns: { id: 'text' } });
        expect(await repository.run({ sql: 'select 1', params: [] })).toEqual([{ id: '1' }]);
        expect(await repository.client.query('select 1')).toEqual({ rows: [{ id: '1' }] });
    });

    it('exposes the supplied attachPersistedRecordAccessors hook to the executor', () => {
        const attach = vi.fn();
        const repository = aQueryExecutor<{ id: string }>({ attachPersistedRecordAccessors: attach });

        expect(repository.attachPersistedRecordAccessors).toBe(attach);
    });

    it('omits attachPersistedRecordAccessors entirely when no override is supplied', () => {
        const repository = aQueryExecutor<{ id: string }>();

        expect(repository.attachPersistedRecordAccessors).toBeUndefined();
    });
});
