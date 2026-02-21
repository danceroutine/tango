import type pg from 'pg';
import type { DBClient } from '../DBClient';

/**
 * `DBClient` implementation backed by a PostgreSQL pool client.
 */
export class PostgresClient implements DBClient {
    static readonly BRAND = 'tango.orm.postgres_client' as const;
    readonly __tangoBrand: typeof PostgresClient.BRAND = PostgresClient.BRAND;

    constructor(
        private pool: pg.Pool,
        private client: pg.PoolClient
    ) {}

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
     * Release client resources and close the associated pool.
     */
    async close(): Promise<void> {
        this.client.release();
        await this.pool.end();
    }
}
