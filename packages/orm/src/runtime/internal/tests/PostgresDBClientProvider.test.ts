import { beforeEach, describe, expect, it, vi } from 'vitest';

const poolQuery = vi.fn(async () => ({ rows: [{ id: 1 }] }));
const clientQuery = vi.fn(async () => ({ rows: [{ id: 2 }] }));
const clientRelease = vi.fn();
const poolConnect = vi.fn(async () => ({ query: clientQuery, release: clientRelease }));
const poolEnd = vi.fn(async () => {});

vi.mock('pg', () => ({
    default: {
        Pool: class {
            query = poolQuery;
            connect = poolConnect;
            end = poolEnd;
        },
    },
}));

import { PostgresClient } from '../../../connection/clients/dialects/PostgresClient';
import { PostgresDBClientProvider } from '../PostgresDBClientProvider';

describe(PostgresDBClientProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('runs autocommit queries through the pool', async () => {
        const provider = new PostgresDBClientProvider({ url: 'postgres://example' });

        await expect(provider.query('SELECT 1', [1])).resolves.toEqual({ rows: [{ id: 1 }] });
        expect(poolQuery).toHaveBeenCalledWith('SELECT 1', [1]);

        await provider.reset();
        expect(poolEnd).toHaveBeenCalledOnce();
    });

    it('leases transactional clients and releases them idempotently', async () => {
        const provider = new PostgresDBClientProvider({ url: 'postgres://example' });

        const lease = await provider.leaseTransactionClient();
        expect(lease.client).toBeInstanceOf(PostgresClient);
        await expect(lease.client.query('SELECT tx')).resolves.toEqual({ rows: [{ id: 2 }] });

        await lease.release();
        await lease.release();

        expect(clientRelease).toHaveBeenCalledOnce();

        await provider.reset();
        expect(poolEnd).toHaveBeenCalledOnce();
    });

    it('rejects reset while a transaction lease is still active', async () => {
        const provider = new PostgresDBClientProvider({ url: 'postgres://example' });
        const lease = await provider.leaseTransactionClient();

        await expect(provider.reset()).rejects.toThrow(/transaction leases are still active/i);

        await lease.release();
        await expect(provider.reset()).resolves.toBeUndefined();
    });
});
