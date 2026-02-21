import { describe, expect, it, vi } from 'vitest';
import { aDBClient } from '@danceroutine/tango-testing';
import { PostgresIntrospector } from '../PostgresIntrospector';

describe(PostgresIntrospector, () => {
    it('reads postgres schema metadata', async () => {
        const query = vi.fn(async (sql: string) => {
            if (sql.includes('FROM pg_class')) {
                return { rows: [{ tbl_oid: '100', table: 'users' }] };
            }
            if (sql.includes('FROM pg_attribute')) {
                return {
                    rows: [
                        { name: 'id', type: 'integer', not_null: true, default_expr: "nextval('users_id_seq')" },
                        { name: 'email', type: 'text', not_null: false, default_expr: null },
                    ],
                };
            }
            if (sql.includes('FROM pg_index')) {
                return { rows: [{ col: 'id' }] };
            }
            return { rows: [] };
        });

        const introspector = new PostgresIntrospector();
        expect(PostgresIntrospector.isPostgresIntrospector(introspector)).toBe(true);
        expect(PostgresIntrospector.isPostgresIntrospector({})).toBe(false);

        const schema = await introspector.introspect(aDBClient({ query }));
        expect(schema.tables['users']!.name).toBe('users');
        expect(schema.tables['users']!.pks).toEqual(['id']);
        expect(schema.tables['users']!.columns['id']!.default).toContain('nextval');
        expect(schema.tables['users']!.columns['email']!.default).toBeNull();
    });

    it('maps index columns and where_clause from postgres index introspection', async () => {
        const query = vi.fn(async (sql: string) => {
            if (sql.includes('FROM pg_class')) {
                return { rows: [{ tbl_oid: '100', table: 'posts' }] };
            }
            if (sql.includes('FROM pg_attribute')) {
                return {
                    rows: [{ name: 'id', type: 'integer', not_null: true, default_expr: "nextval('posts_id_seq')" }],
                };
            }
            if (sql.includes('FROM pg_index') && sql.includes('con.oid IS NULL')) {
                return {
                    rows: [
                        {
                            name: 'posts_slug_unique',
                            unique: true,
                            where_clause: 'published = true',
                            columns: ['slug'],
                        },
                    ],
                };
            }
            if (sql.includes('FROM pg_index')) {
                return { rows: [{ col: 'id' }] };
            }
            return { rows: [] };
        });

        const introspector = new PostgresIntrospector();
        const schema = await introspector.introspect(aDBClient({ query }));

        expect(schema.tables['posts']!.indexes['posts_slug_unique']).toEqual({
            name: 'posts_slug_unique',
            table: 'posts',
            unique: true,
            columns: ['slug'],
            where: 'published = true',
        });
    });
});
