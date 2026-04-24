import { describe, expect, it } from 'vitest';
import { PostgresAdapter, SqliteAdapter } from '@danceroutine/tango-orm';
import { anAdapter } from '../anAdapter';

describe(anAdapter, () => {
    it('returns a Postgres adapter by default', () => {
        const adapter = anAdapter();

        expect(adapter).toBeInstanceOf(PostgresAdapter);
        expect(adapter.dialect).toBe('postgres');
    });

    it('returns a Postgres adapter when dialect override is postgres', () => {
        const adapter = anAdapter({ dialect: 'postgres' });

        expect(adapter).toBeInstanceOf(PostgresAdapter);
        expect(adapter.dialect).toBe('postgres');
    });

    it('returns a SQLite adapter when dialect override is sqlite', () => {
        const adapter = anAdapter({ dialect: 'sqlite' });

        expect(adapter).toBeInstanceOf(SqliteAdapter);
        expect(adapter.dialect).toBe('sqlite');
    });
    it('throws an error when an unsupported dialect is provided', () => {
        expect(() => anAdapter({ dialect: 'unknown' as unknown as 'postgres' })).toThrow(
            'Unsupported dialect: unknown'
        );
    });
});
