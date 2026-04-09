import type { DBClient } from '../../connection/clients/DBClient';

export interface TransactionClientLease {
    readonly client: DBClient;
    release(): Promise<void>;
}

export interface DBClientProvider {
    query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<{ rows: T[] }>;
    leaseTransactionClient(): Promise<TransactionClientLease>;
    reset(): Promise<void>;
}
