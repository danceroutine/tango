import { describe, expect, it, vi } from 'vitest';
import type { AdapterConfig } from '../../Adapter';
import { SqliteAdapter } from '../SqliteAdapter';
import { SqliteClient } from '../../../clients/dialects/SqliteClient';

vi.mock('pg', () => {
    const connect = vi.fn(async () => ({
        query: vi.fn(async () => ({ rows: [] })),
        release: vi.fn(),
    }));
    const end = vi.fn(async () => {});
    class Pool {
        connect = connect;
        end = end;
    }
    return { default: { Pool } };
});

describe('dialect adapters', () => {
    it('returns a sqlite client for sqlite connections', async () => {
        const adapter = new SqliteAdapter();
        const client = await adapter.connect({ filename: ':memory:' } satisfies AdapterConfig);
        const fallbackClient = await adapter.connect({});

        expect(SqliteAdapter.isSqliteAdapter(adapter)).toBe(true);
        expect(SqliteAdapter.isSqliteAdapter({})).toBe(false);
        expect(client).toBeInstanceOf(SqliteClient);
        await client.close();
        await fallbackClient.close();
    });

    it('returns a postgres client for postgres connections', async () => {
        const { PostgresAdapter } = await import('../PostgresAdapter');
        const { PostgresClient } = await import('../../../clients/dialects/PostgresClient');

        const adapter = new PostgresAdapter();
        const client = await adapter.connect({ url: 'postgres://example' });

        expect(PostgresAdapter.isPostgresAdapter(adapter)).toBe(true);
        expect(PostgresAdapter.isPostgresAdapter({})).toBe(false);
        expect(client).toBeInstanceOf(PostgresClient);
        await client.close();
    });
});
