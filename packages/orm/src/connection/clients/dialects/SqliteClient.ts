import type Database from 'better-sqlite3';
import type { DBClient } from '../DBClient';

/**
 * Transaction-capable client backed by a synchronous `better-sqlite3` handle.
 */
export class SqliteClient implements DBClient {
    static readonly BRAND = 'tango.orm.sqlite_client' as const;
    readonly __tangoBrand: typeof SqliteClient.BRAND = SqliteClient.BRAND;
    private inTransaction = false;

    constructor(private db: Database.Database) {}

    /**
     * Narrow an unknown value to `SqliteClient`.
     */
    static isSqliteClient(value: unknown): value is SqliteClient {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === SqliteClient.BRAND
        );
    }

    /**
     * Execute a SQL statement with optional parameters.
     *
     * `SELECT`/`PRAGMA` statements return row data; write statements return
     * an empty row list.
     */
    async query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<{ rows: T[] }> {
        const stmt = this.db.prepare(sql);
        const isPragmaWrite = /^\s*PRAGMA\b/i.test(sql) && /=/.test(sql);

        const normalizedParams = params?.map((param) => this.normalizeParam(param));

        if (!isPragmaWrite && stmt.reader) {
            const rows = normalizedParams ? stmt.all(...(normalizedParams as unknown[])) : stmt.all();
            return { rows: rows as T[] };
        }

        if (normalizedParams) {
            stmt.run(...(normalizedParams as unknown[]));
        } else {
            stmt.run();
        }
        return { rows: [] };
    }

    /**
     * Begin a transaction if one is not already active.
     */
    async begin(): Promise<void> {
        if (!this.inTransaction) {
            this.db.prepare('BEGIN IMMEDIATE').run();
            this.inTransaction = true;
        }
    }

    /**
     * Commit the active transaction.
     */
    async commit(): Promise<void> {
        if (this.inTransaction) {
            this.db.prepare('COMMIT').run();
            this.inTransaction = false;
        }
    }

    /**
     * Roll back the active transaction.
     */
    async rollback(): Promise<void> {
        if (this.inTransaction) {
            this.db.prepare('ROLLBACK').run();
            this.inTransaction = false;
        }
    }

    /**
     * Create a savepoint inside the active transaction.
     */
    async createSavepoint(name: string): Promise<void> {
        this.db.prepare(`SAVEPOINT ${name}`).run();
    }

    /**
     * Release a previously-created savepoint.
     */
    async releaseSavepoint(name: string): Promise<void> {
        this.db.prepare(`RELEASE SAVEPOINT ${name}`).run();
    }

    /**
     * Roll back the active transaction to a savepoint.
     */
    async rollbackToSavepoint(name: string): Promise<void> {
        this.db.prepare(`ROLLBACK TO SAVEPOINT ${name}`).run();
    }

    /**
     * Close the underlying SQLite handle.
     */
    async close(): Promise<void> {
        this.db.close();
    }

    private normalizeParam(value: unknown): unknown {
        if (isDateValue(value)) {
            return value.toISOString();
        }
        if (typeof value === 'boolean') {
            return value ? 1 : 0;
        }
        return value;
    }
}

function isDateValue(value: unknown): value is Date {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as { getTime?: unknown }).getTime === 'function' &&
        typeof (value as { toISOString?: unknown }).toISOString === 'function'
    );
}
