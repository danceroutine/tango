import { PostgresAdapter, SqliteAdapter, type Adapter } from '@danceroutine/tango-orm';
import type { Dialect } from '@danceroutine/tango-orm/query';

export type AdapterOverrides = {
    dialect?: Dialect;
};

/**
 * Create a real built-in `Adapter` instance for unit tests that need one.
 *
 * Defaults to a Postgres adapter; pass `{ dialect: 'sqlite' }` to obtain a
 * SQLite adapter. The returned adapter carries the matching placeholder
 * formatter so compilers exercised under test emit dialect-accurate SQL.
 */
export function anAdapter(overrides: AdapterOverrides = {}): Adapter {
    const dialect: Dialect = overrides.dialect ?? 'postgres';
    switch (dialect) {
        case 'postgres':
            return new PostgresAdapter();
        case 'sqlite':
            return new SqliteAdapter();
        default:
            throw new Error(`Unsupported dialect: ${dialect}`);
    }
}
