import { describe, expect, it, vi } from 'vitest';
import { aDBClient } from '@danceroutine/tango-testing';
import { SqliteIntrospector } from '../SqliteIntrospector';

describe(SqliteIntrospector, () => {
    it('reads sqlite tables, columns, and indexes', async () => {
        const query = vi.fn(async (sql: string) => {
            if (sql.includes('sqlite_master')) {
                return { rows: [{ name: 'users' }] };
            }
            if (sql.includes('PRAGMA table_info("users")')) {
                return {
                    rows: [
                        { name: 'id', pk: 1, type: 'INTEGER', notnull: 1, dflt_value: null },
                        { name: 'email', pk: 0, type: 'TEXT', notnull: 0, dflt_value: "'x'" },
                    ],
                };
            }
            if (sql.includes('PRAGMA index_list("users")')) {
                return {
                    rows: [
                        { name: 'users_email_idx', unique: 1 },
                        { name: 'sqlite_autoindex_users_1', unique: 1 },
                    ],
                };
            }
            if (sql.includes('PRAGMA index_info("users_email_idx")')) {
                return { rows: [{ name: 'email' }] };
            }
            return { rows: [] };
        });

        const introspector = new SqliteIntrospector();
        expect(SqliteIntrospector.isSqliteIntrospector(introspector)).toBe(true);
        expect(SqliteIntrospector.isSqliteIntrospector({})).toBe(false);

        const schema = await introspector.introspect(aDBClient({ query }));
        expect(schema.tables['users']!.name).toBe('users');
        expect(schema.tables['users']!.pks).toEqual(['id']);
        expect(schema.tables['users']!.columns['id']!.notNull).toBe(true);
        expect(schema.tables['users']!.columns['email']!.default).toBe("'x'");
        expect(schema.tables['users']!.indexes['users_email_idx']!.columns).toEqual(['email']);
        expect(schema.tables['users']!.indexes['sqlite_autoindex_users_1']).toBeUndefined();
    });
});
