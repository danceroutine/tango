import type { DBClient } from '../DBClient';

export interface PostgresPoolClientLike {
    query(sql: string, params?: readonly unknown[]): Promise<{ rows: unknown[] }>;
    release(): void;
}

/**
 * Transaction-capable client backed by a PostgreSQL pool client.
 */
export class PostgresClient implements DBClient {
    static readonly BRAND = 'tango.orm.postgres_client' as const;
    readonly __tangoBrand: typeof PostgresClient.BRAND = PostgresClient.BRAND;

    constructor(private client: PostgresPoolClientLike) {}

    /**
     * Narrow an unknown value to `PostgresClient`.
     */
    static isPostgresClient(value: unknown): value is PostgresClient {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === PostgresClient.BRAND
        );
    }

    /**
     * Execute a SQL statement with optional bound parameters.
     */
    async query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<{ rows: T[] }> {
        const result = await this.client.query(sql, params as unknown[]);
        return { rows: result.rows as T[] };
    }

    /**
     * Begin a database transaction.
     */
    async begin(): Promise<void> {
        await this.client.query('BEGIN');
    }

    /**
     * Commit the active transaction.
     */
    async commit(): Promise<void> {
        await this.client.query('COMMIT');
    }

    /**
     * Roll back the active transaction.
     */
    async rollback(): Promise<void> {
        await this.client.query('ROLLBACK');
    }

    /**
     * Create a savepoint inside the active transaction.
     */
    async createSavepoint(name: string): Promise<void> {
        await this.client.query(`SAVEPOINT ${name}`);
    }

    /**
     * Release a previously-created savepoint.
     */
    async releaseSavepoint(name: string): Promise<void> {
        await this.client.query(`RELEASE SAVEPOINT ${name}`);
    }

    /**
     * Roll back the active transaction to a savepoint.
     */
    async rollbackToSavepoint(name: string): Promise<void> {
        await this.client.query(`ROLLBACK TO SAVEPOINT ${name}`);
    }

    /**
     * Release the leased PostgreSQL client back to its owning pool.
     */
    async close(): Promise<void> {
        this.client.release();
    }
}
