import { describe, expect, it, vi } from 'vitest';

vi.mock('pg', () => ({
    default: {
        Pool: class {
            query = vi.fn(async () => ({ rows: [] }));
            connect = vi.fn(async () => ({ query: vi.fn(async () => ({ rows: [] })), release: vi.fn() }));
            end = vi.fn(async () => {});
        },
    },
}));

import { PostgresDBClientProvider } from '../PostgresDBClientProvider';
import { SqliteDBClientProvider } from '../SqliteDBClientProvider';
import { createDBClientProvider } from '../createDBClientProvider';

describe(createDBClientProvider, () => {
    it('creates the postgres provider when configured for postgres', async () => {
        const provider = createDBClientProvider({ adapter: 'postgres', url: 'postgres://example' });
        expect(provider).toBeInstanceOf(PostgresDBClientProvider);
        await provider.reset();
    });

    it('creates the sqlite provider when configured for sqlite', async () => {
        const provider = createDBClientProvider({ adapter: 'sqlite', filename: ':memory:' });
        expect(provider).toBeInstanceOf(SqliteDBClientProvider);
        await provider.reset();
    });

    it('rejects unsupported adapters', () => {
        expect(() => createDBClientProvider({ adapter: 'mysql' })).toThrow(/Unsupported adapter/);
    });
});
