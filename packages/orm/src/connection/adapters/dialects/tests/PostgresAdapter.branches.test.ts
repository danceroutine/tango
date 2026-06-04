import { afterEach, describe, expect, it, vi } from 'vitest';

describe('PostgresAdapter driver resolution branches', () => {
    afterEach(() => {
        vi.doUnmock('pg');
        vi.resetModules();
    });

    it('loads the Pool constructor from a named pg export', async () => {
        const connect = vi.fn(async () => ({
            query: vi.fn(async () => ({ rows: [] })),
            release: vi.fn(),
        }));

        vi.doMock('pg', () => ({
            Pool: class {
                connect = connect;
            },
        }));

        const { PostgresAdapter } = await import('../PostgresAdapter');
        const adapter = new PostgresAdapter();
        const client = await adapter.connect({ url: 'postgres://example' });

        expect(connect).toHaveBeenCalledOnce();
        await client.close();
    });

    it('rejects malformed pg modules', async () => {
        vi.doMock('pg', () => ({}));

        const { PostgresAdapter } = await import('../PostgresAdapter');
        const adapter = new PostgresAdapter();

        await expect(adapter.connect({ url: 'postgres://example' })).rejects.toThrow(
            'Failed to load pg Pool constructor.'
        );
    });
});
