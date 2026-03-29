import { describe, expect, it } from 'vitest';
import { trustedSql } from '@danceroutine/tango-core';
import { MigrationSqlSafetyAdapter } from '../MigrationSqlSafetyAdapter';

describe(MigrationSqlSafetyAdapter, () => {
    it('quotes validated identifiers for the target dialect', () => {
        const sqlite = new MigrationSqlSafetyAdapter('sqlite');
        const postgres = new MigrationSqlSafetyAdapter('postgres');

        expect(sqlite.table('users')).toBe('"users"');
        expect(sqlite.column('email')).toBe('"email"');
        expect(postgres.schema('public')).toBe('"public"');
        expect(postgres.index('users_email_idx')).toBe('"users_email_idx"');
    });

    it('accepts reviewed raw fragments and rejects untrusted ones', () => {
        const adapter = new MigrationSqlSafetyAdapter('postgres');

        expect(adapter.rawFragment('where', trustedSql('deleted_at IS NULL'))).toBe('deleted_at IS NULL');
        expect(adapter.rawDefault(trustedSql('true'), 'now()')).toBe('true');
        expect(adapter.rawDefault({ now: true }, 'now()')).toBe('now()');

        expect(() => adapter.rawFragment('where', { sql: 'deleted_at IS NULL' } as never)).toThrow(
            /untrusted raw sql fragment/i
        );
    });
});
