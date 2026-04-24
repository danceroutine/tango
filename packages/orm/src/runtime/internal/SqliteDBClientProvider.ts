import { createRequire } from 'node:module';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import type { AdapterConfig } from '../../connection/adapters/Adapter';
import { SqliteClient } from '../../connection/clients/dialects/SqliteClient';
import type { DBClientProvider, TransactionClientLease } from './DBClientProvider';

type BetterSqliteCtor = new (filename: string, options?: unknown) => BetterSqliteDatabase;

export class SqliteDBClientProvider implements DBClientProvider {
    private readonly filename: string;
    private readonly Database: BetterSqliteCtor;
    private readonly autocommitClient: SqliteClient;
    private activeLeaseCount = 0;
    private exclusiveTail: Promise<void> = Promise.resolve();

    constructor(config: AdapterConfig = {}) {
        this.Database = this.getDatabaseCtor();
        this.filename =
            typeof config.filename === 'string' && config.filename.length > 0 ? config.filename : ':memory:';
        this.autocommitClient = this.openClient(this.filename);
    }

    async query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<{ rows: T[] }> {
        return this.runExclusive(() => this.autocommitClient.query<T>(sql, params));
    }

    async leaseTransactionClient(): Promise<TransactionClientLease> {
        if (this.filename === ':memory:') {
            throw new Error('transaction.atomic(...) requires a file-backed SQLite database. :memory: is unsupported.');
        }

        const releaseExclusive = await this.acquireExclusive();
        try {
            const client = this.openClient(this.filename);
            this.activeLeaseCount += 1;
            let released = false;

            return {
                client,
                release: async () => {
                    if (released) {
                        return;
                    }

                    released = true;
                    this.activeLeaseCount -= 1;
                    try {
                        await client.close();
                    } finally {
                        releaseExclusive();
                    }
                },
            };
        } catch (error) {
            releaseExclusive();
            throw error;
        }
    }

    async reset(): Promise<void> {
        if (this.activeLeaseCount > 0) {
            throw new Error('Cannot reset Tango runtime while transaction leases are still active.');
        }

        await this.autocommitClient.close();
    }

    private openClient(filename: string): SqliteClient {
        const db = new this.Database(filename);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        db.pragma('busy_timeout = 5000');
        return new SqliteClient(db);
    }

    private async runExclusive<T>(work: () => Promise<T>): Promise<T> {
        const release = await this.acquireExclusive();
        try {
            return await work();
        } finally {
            release();
        }
    }

    private async acquireExclusive(): Promise<() => void> {
        const previous = this.exclusiveTail;
        let release: (() => void) | null = null;
        this.exclusiveTail = new Promise<void>((resolve) => {
            release = resolve;
        });
        await previous;
        return () => {
            release?.();
        };
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
