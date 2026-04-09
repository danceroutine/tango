import pg from 'pg';
import type { AdapterConfig } from '../../connection/adapters/Adapter';
import { PostgresClient } from '../../connection/clients/dialects/PostgresClient';
import type { DBClientProvider, TransactionClientLease } from './DBClientProvider';

const { Pool } = pg;

export class PostgresDBClientProvider implements DBClientProvider {
    private readonly pool: pg.Pool;
    private activeLeaseCount = 0;

    constructor(config: AdapterConfig) {
        this.pool = new Pool({
            connectionString: config.url,
            host: config.host,
            port: config.port,
            database: config.database,
            user: config.user,
            password: config.password,
            max: config.maxConnections || 10,
        });
    }

    async query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<{ rows: T[] }> {
        const result = await this.pool.query(sql, params as unknown[]);
        return { rows: result.rows as T[] };
    }

    async leaseTransactionClient(): Promise<TransactionClientLease> {
        const client = await this.pool.connect();
        this.activeLeaseCount += 1;
        let released = false;

        return {
            client: new PostgresClient(client),
            release: async () => {
                if (released) {
                    return;
                }

                released = true;
                this.activeLeaseCount -= 1;
                client.release();
            },
        };
    }

    async reset(): Promise<void> {
        if (this.activeLeaseCount > 0) {
            throw new Error('Cannot reset Tango runtime while transaction leases are still active.');
        }

        await this.pool.end();
    }
}
