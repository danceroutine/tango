import { afterEach, describe, expect, it, vi } from 'vitest';

describe('PostgresDBClientProvider driver resolution branches', () => {
    afterEach(() => {
        vi.doUnmock('pg');
        vi.resetModules();
    });

    it('loads the Pool constructor from a named pg export', async () => {
        const poolQuery = vi.fn(async () => ({ rows: [{ ok: true }] }));
        const poolEnd = vi.fn(async () => {});

        vi.doMock('pg', () => ({
            Pool: class {
                query = poolQuery;
                end = poolEnd;
            },
        }));

        const { PostgresDBClientProvider } = await import('../PostgresDBClientProvider');
        const provider = new PostgresDBClientProvider({ url: 'postgres://example' });

        await expect(provider.query('SELECT 1')).resolves.toEqual({ rows: [{ ok: true }] });
        await expect(provider.query('SELECT 2')).resolves.toEqual({ rows: [{ ok: true }] });
        await provider.reset();

        expect(poolQuery).toHaveBeenCalledTimes(2);
        expect(poolEnd).toHaveBeenCalledOnce();
    });

    it('rejects malformed pg modules', async () => {
        vi.doMock('pg', () => ({}));

        const { PostgresDBClientProvider } = await import('../PostgresDBClientProvider');
        const provider = new PostgresDBClientProvider({ url: 'postgres://example' });

        await expect(provider.query('SELECT 1')).rejects.toThrow('Failed to load pg Pool constructor.');
    });
});
