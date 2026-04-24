import type { LoadedConfig } from '@danceroutine/tango-config';
import type { DBClient } from '../connection/index';
import type { Adapter } from '../connection/adapters/Adapter';
import { PostgresAdapter } from '../connection/adapters/dialects/PostgresAdapter';
import { SqliteAdapter } from '../connection/adapters/dialects/SqliteAdapter';
import type { Dialect } from '../query/domain/index';
import { InternalDialect } from '../query/domain/internal/InternalDialect';
import { RuntimeBoundClient } from '../manager/internal/RuntimeBoundClient';
import type { DBClientProvider, TransactionClientLease } from './internal/DBClientProvider';
import { createDBClientProvider } from './internal/createDBClientProvider';

/**
 * Framework-owned database runtime that resolves Tango config and lazily
 * creates the shared connection provider used by manager-backed models.
 */
export class TangoRuntime {
    static readonly BRAND = 'tango.orm.runtime' as const;
    readonly __tangoBrand: typeof TangoRuntime.BRAND = TangoRuntime.BRAND;
    private readonly loadedConfig: LoadedConfig;
    private providerPromise: Promise<DBClientProvider> | null = null;
    private runtimeClientPromise: Promise<DBClient> | null = null;
    private cachedAdapter: Adapter | null = null;

    constructor(loadLoadedConfig: () => LoadedConfig) {
        this.loadedConfig = loadLoadedConfig();
    }

    /**
     * Narrow an unknown value to `TangoRuntime`.
     */
    static isTangoRuntime(value: unknown): value is TangoRuntime {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === TangoRuntime.BRAND
        );
    }

    /**
     * Return the loaded Tango config snapshot for the active environment.
     */
    getConfig(): LoadedConfig {
        return this.loadedConfig;
    }

    /**
     * Return the configured SQL dialect for the current runtime.
     */
    getDialect(): Dialect {
        return this.loadedConfig.current.db.adapter;
    }

    /**
     * Return the adapter backing the configured dialect. Manager-side
     * compilers use this to obtain placeholder formatters and dialect
     * capabilities without branching on the raw dialect string.
     */
    getAdapter(): Adapter {
        if (!this.cachedAdapter) {
            this.cachedAdapter = this.buildAdapterForDialect(this.getDialect());
        }
        return this.cachedAdapter;
    }

    /**
     * Return the runtime-bound DB client facade used by manager-backed code.
     */
    async getClient(): Promise<DBClient> {
        if (!this.runtimeClientPromise) {
            this.runtimeClientPromise = Promise.resolve(new RuntimeBoundClient(this));
        }

        return this.runtimeClientPromise;
    }

    /**
     * Execute SQL through the autocommit path owned by this runtime.
     */
    async query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<{ rows: T[] }> {
        const provider = await this.getProvider();
        return provider.query<T>(sql, params);
    }

    /**
     * Lease a transaction-scoped client for `transaction.atomic(...)`.
     */
    async leaseTransactionClient(): Promise<TransactionClientLease> {
        const provider = await this.getProvider();
        return provider.leaseTransactionClient();
    }

    /**
     * Close and clear the cached runtime resources so tests can start fresh.
     */
    async reset(): Promise<void> {
        if (!this.providerPromise) {
            this.runtimeClientPromise = null;
            return;
        }

        const provider = await this.providerPromise;
        this.providerPromise = null;
        this.runtimeClientPromise = null;
        await provider.reset();
    }

    private buildAdapterForDialect(dialect: Dialect): Adapter {
        switch (dialect) {
            case InternalDialect.POSTGRES:
                return new PostgresAdapter();
            case InternalDialect.SQLITE:
                return new SqliteAdapter();
        }
    }

    private async getProvider(): Promise<DBClientProvider> {
        if (!this.providerPromise) {
            const db = this.loadedConfig.current.db;
            this.providerPromise = Promise.resolve(
                createDBClientProvider({
                    adapter: db.adapter,
                    url: db.url,
                    host: db.host,
                    port: db.port,
                    database: db.database,
                    user: db.user,
                    password: db.password,
                    filename: db.filename,
                    maxConnections: db.maxConnections,
                })
            );
        }

        return this.providerPromise;
    }
}
