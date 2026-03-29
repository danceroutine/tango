import { describe, expect, it, vi } from 'vitest';
import { PostgresClient } from '../PostgresClient';

describe(PostgresClient, () => {
    it('executes queries and transaction methods', async () => {
        const query = vi.fn(async () => ({ rows: [{ id: 1 }] }));
        const release = vi.fn();
        const end = vi.fn(async () => {});
        const client = new PostgresClient(
            { end } as unknown as ConstructorParameters<typeof PostgresClient>[0],
            { query, release } as unknown as ConstructorParameters<typeof PostgresClient>[1]
        );

        await expect(client.query('SELECT 1')).resolves.toEqual({ rows: [{ id: 1 }] });
        await client.begin();
        await client.commit();
        await client.rollback();
        await client.close();

        expect(query).toHaveBeenCalledWith('SELECT 1', undefined);
        expect(query).toHaveBeenCalledWith('BEGIN');
        expect(query).toHaveBeenCalledWith('COMMIT');
        expect(query).toHaveBeenCalledWith('ROLLBACK');
        expect(release).toHaveBeenCalledOnce();
        expect(end).toHaveBeenCalledOnce();
    });

    it('identifies matching instances', () => {
        const client = new PostgresClient(
            { end: vi.fn(async () => {}) } as unknown as ConstructorParameters<typeof PostgresClient>[0],
            { query: vi.fn(async () => ({ rows: [] })), release: vi.fn() } as unknown as ConstructorParameters<
                typeof PostgresClient
            >[1]
        );

        expect(PostgresClient.isPostgresClient(client)).toBe(true);
        expect(PostgresClient.isPostgresClient({})).toBe(false);
    });
});
