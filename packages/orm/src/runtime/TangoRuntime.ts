import type { LoadedConfig } from '@danceroutine/tango-config';
import type { DBClient } from '../connection/index';
import { connectDB } from '../connection/index';
import type { Dialect } from '../query/domain/index';

/**
 * Framework-owned database runtime that resolves Tango config and lazily
 * creates the shared DB client used by manager-backed models.
 */
export class TangoRuntime {
    static readonly BRAND = 'tango.orm.runtime' as const;
    readonly __tangoBrand: typeof TangoRuntime.BRAND = TangoRuntime.BRAND;
    private readonly loadedConfig: LoadedConfig;
    private clientPromise: Promise<DBClient> | null = null;

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
     * Return the shared DB client, creating it once on first access.
     */
    async getClient(): Promise<DBClient> {
        if (!this.clientPromise) {
            const db = this.loadedConfig.current.db;
            this.clientPromise = connectDB({
                adapter: db.adapter,
                url: db.url,
                host: db.host,
                port: db.port,
                database: db.database,
                user: db.user,
                password: db.password,
                filename: db.filename,
                maxConnections: db.maxConnections,
            });
        }

        return this.clientPromise;
    }

    /**
     * Close and clear the cached DB client so tests can start fresh.
     */
    async reset(): Promise<void> {
        if (!this.clientPromise) {
            return;
        }

        const client = await this.clientPromise;
        this.clientPromise = null;
        await client.close();
    }
}
