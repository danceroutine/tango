import type { PostgresPoolClientLike } from './PostgresClient';

export type PostgresPoolLike = {
    query(sql: string, params?: readonly unknown[]): Promise<{ rows: unknown[] }>;
    connect(): Promise<PostgresPoolClientLike>;
    end(): Promise<void>;
};

type PostgresPoolConstructor = new (config: {
    connectionString?: string;
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    max: number;
}) => PostgresPoolLike;

export type PostgresPoolConfig = {
    url?: string;
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    maxConnections?: number;
};

export class PostgresPoolProvider {
    async createPool(config: PostgresPoolConfig): Promise<PostgresPoolLike> {
        const Pool = await this.loadPostgresPoolConstructor();
        return new Pool({
            connectionString: config.url,
            host: config.host,
            port: config.port,
            database: config.database,
            user: config.user,
            password: config.password,
            max: config.maxConnections || 10,
        });
    }

    private async loadPostgresPoolConstructor(): Promise<PostgresPoolConstructor> {
        return this.resolvePostgresPoolConstructor(await import('pg'));
    }

    private resolvePostgresPoolConstructor(moduleValue: unknown): PostgresPoolConstructor {
        const defaultPool = this.readProperty(this.readProperty(moduleValue, 'default'), 'Pool');
        if (typeof defaultPool === 'function') {
            return defaultPool as PostgresPoolConstructor;
        }

        const directPool = this.readProperty(moduleValue, 'Pool');
        if (typeof directPool === 'function') {
            return directPool as PostgresPoolConstructor;
        }

        throw new TypeError('Failed to load pg Pool constructor.');
    }

    private readProperty(value: unknown, key: string): unknown {
        if (typeof value !== 'object' || value === null || !(key in value)) {
            return undefined;
        }

        return (value as Record<string, unknown>)[key];
    }
}
