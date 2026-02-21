import { createRequire } from 'node:module';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import type { Adapter, AdapterConfig } from '../Adapter';
import type { DBClient } from '../../clients/DBClient';
import { SqliteClient } from '../../clients/dialects/SqliteClient';

type BetterSqliteCtor = new (filename: string, options?: unknown) => BetterSqliteDatabase;

/**
 * SQLite adapter that creates a `better-sqlite3` backed `DBClient`.
 */
export class SqliteAdapter implements Adapter {
    static readonly BRAND = 'tango.orm.sqlite_adapter' as const;
    readonly __tangoBrand: typeof SqliteAdapter.BRAND = SqliteAdapter.BRAND;
    readonly name = 'sqlite';
    readonly features = {
        transactionalDDL: true,
        concurrentIndex: false,
        validateForeignKeys: false,
    };

    /**
     * Narrow an unknown value to `SqliteAdapter`.
     */
    static isSqliteAdapter(value: unknown): value is SqliteAdapter {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === SqliteAdapter.BRAND
        );
    }

    /**
     * Open a SQLite database and apply baseline pragmas for durability/safety.
     */
    async connect(config: AdapterConfig = {}): Promise<DBClient> {
        const Database = this.getDatabaseCtor();
        const filename =
            typeof config.filename === 'string' && config.filename.length > 0 ? config.filename : ':memory:';
        const db = new Database(filename);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');

        return new SqliteClient(db);
    }

    private getDatabaseCtor(): BetterSqliteCtor {
        const require = createRequire(import.meta.url);
        const moduleValue = require('better-sqlite3') as unknown;
        if (typeof moduleValue === 'function') {
            return moduleValue as BetterSqliteCtor;
        }

        const defaultExport = (moduleValue as { default?: unknown }).default;
        if (typeof defaultExport === 'function') {
            return defaultExport as BetterSqliteCtor;
        }

        throw new TypeError('Failed to load better-sqlite3 constructor.');
    }
}
