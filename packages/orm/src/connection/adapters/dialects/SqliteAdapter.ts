import { createRequire } from 'node:module';
import type { Adapter, AdapterConfig, SqlPlaceholders } from '../Adapter';
import type { DBClient } from '../../clients/DBClient';
import { SqliteClient } from '../../clients/dialects/SqliteClient';
import type { SqliteDatabaseConstructor } from '../../clients/dialects/SqliteDatabaseLike';
import { InternalDialect } from '../../../query/domain/internal/InternalDialect';

/**
 * SQLite adapter that creates a `better-sqlite3` backed `DBClient`.
 */
export class SqliteAdapter implements Adapter {
    static readonly BRAND = 'tango.orm.sqlite_adapter' as const;
    readonly __tangoBrand: typeof SqliteAdapter.BRAND = SqliteAdapter.BRAND;
    readonly name = 'sqlite';
    readonly dialect: Adapter['dialect'] = InternalDialect.SQLITE;
    readonly features: Adapter['features'] = {
        transactionalDDL: true,
        concurrentIndex: false,
        validateForeignKeys: false,
        ignoreDuplicateInsert: true,
    };
    readonly placeholders: SqlPlaceholders = {
        at(): string {
            return '?';
        },
        list(count: number): string {
            return Array.from({ length: count }, () => '?').join(', ');
        },
        listFromOffset(count: number): string {
            return this.list(count);
        },
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
        db.pragma('busy_timeout = 5000');

        return new SqliteClient(db);
    }

    private getDatabaseCtor(): SqliteDatabaseConstructor {
        const require = createRequire(import.meta.url);
        const moduleValue = require('better-sqlite3') as unknown;
        if (typeof moduleValue === 'function') {
            return moduleValue as SqliteDatabaseConstructor;
        }

        const defaultExport = (moduleValue as { default?: unknown }).default;
        if (typeof defaultExport === 'function') {
            return defaultExport as SqliteDatabaseConstructor;
        }

        throw new TypeError('Failed to load better-sqlite3 constructor.');
    }
}
