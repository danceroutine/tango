import { describe, expect, it, vi } from 'vitest';
import type { PostgresPoolClientLike } from '../PostgresClient';
import { PostgresClient } from '../PostgresClient';

describe(PostgresClient, () => {
    it('executes queries and transaction methods', async () => {
        const query = vi.fn(async () => ({ rows: [{ id: 1 }] }));
        const release = vi.fn();
        const poolClient: PostgresPoolClientLike = { query, release };
        const client = new PostgresClient(poolClient);

        await expect(client.query('SELECT 1')).resolves.toEqual({ rows: [{ id: 1 }] });
        await client.begin();
        await client.createSavepoint('sp1');
        await client.releaseSavepoint('sp1');
        await client.rollbackToSavepoint('sp1');
        await client.commit();
        await client.rollback();
        await client.close();

        expect(query).toHaveBeenCalledWith('SELECT 1', undefined);
        expect(query).toHaveBeenCalledWith('BEGIN');
        expect(query).toHaveBeenCalledWith('SAVEPOINT sp1');
        expect(query).toHaveBeenCalledWith('RELEASE SAVEPOINT sp1');
        expect(query).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT sp1');
        expect(query).toHaveBeenCalledWith('COMMIT');
        expect(query).toHaveBeenCalledWith('ROLLBACK');
        expect(release).toHaveBeenCalledOnce();
    });

    it('identifies matching instances', () => {
        const poolClient: PostgresPoolClientLike = {
            query: vi.fn(async () => ({ rows: [] })),
            release: vi.fn(),
        };
        const client = new PostgresClient(poolClient);

        expect(PostgresClient.isPostgresClient(client)).toBe(true);
        expect(PostgresClient.isPostgresClient({})).toBe(false);
    });
});
