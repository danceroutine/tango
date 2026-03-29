import { describe, expect, it } from 'vitest';
import { PostgresCompilerFactory } from '../PostgresCompilerFactory';
import { SqliteCompilerFactory } from '../SqliteCompilerFactory';
import { PostgresCompiler } from '../../dialects/PostgresCompiler';
import { SqliteCompiler } from '../../dialects/SqliteCompiler';

describe('compiler factories', () => {
    it('returns a postgres compiler instance', () => {
        const factory = new PostgresCompilerFactory();
        expect(PostgresCompilerFactory.isPostgresCompilerFactory(factory)).toBe(true);
        expect(PostgresCompilerFactory.isPostgresCompilerFactory({})).toBe(false);
        expect(factory.create()).toBeInstanceOf(PostgresCompiler);
    });

    it('returns a sqlite compiler instance', () => {
        const factory = new SqliteCompilerFactory();
        expect(SqliteCompilerFactory.isSqliteCompilerFactory(factory)).toBe(true);
        expect(SqliteCompilerFactory.isSqliteCompilerFactory({})).toBe(false);
        expect(factory.create()).toBeInstanceOf(SqliteCompiler);
    });
});
