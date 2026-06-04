import type { AdapterConfig } from '../../connection/adapters/Adapter';
import { PostgresClient } from '../../connection/clients/dialects/PostgresClient';
import { PostgresPoolProvider, type PostgresPoolLike } from '../../connection/clients/dialects/PostgresPoolProvider';
import type { DBClientProvider, TransactionClientLease } from './DBClientProvider';

export class PostgresDBClientProvider implements DBClientProvider {
    private readonly poolProvider = new PostgresPoolProvider();
    private poolPromise: Promise<PostgresPoolLike> | null = null;
    private activeLeaseCount = 0;

    constructor(private readonly config: AdapterConfig) {}

    async query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<{ rows: T[] }> {
        const pool = await this.getPool();
        const result = await pool.query(sql, params);
        return { rows: result.rows as T[] };
    }

    async leaseTransactionClient(): Promise<TransactionClientLease> {
        const pool = await this.getPool();
        const client = await pool.connect();
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

        if (!this.poolPromise) {
            return;
        }

        const pool = await this.poolPromise;
        this.poolPromise = null;
        await pool.end();
    }

    private async getPool(): Promise<PostgresPoolLike> {
        if (!this.poolPromise) {
            this.poolPromise = this.createPool();
        }

        return this.poolPromise;
    }

    private async createPool(): Promise<PostgresPoolLike> {
        return this.poolProvider.createPool(this.config);
    }
}
