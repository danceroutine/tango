import pg from 'pg';
import type { Adapter, AdapterConfig } from '../Adapter';
import type { DBClient } from '../../clients/DBClient';
import { PostgresClient } from '../../clients/dialects/PostgresClient';

const { Pool } = pg;

/**
 * Postgres adapter that turns adapter config into a transactional `DBClient`.
 */
export class PostgresAdapter implements Adapter {
    static readonly BRAND = 'tango.orm.postgres_adapter' as const;
    readonly __tangoBrand: typeof PostgresAdapter.BRAND = PostgresAdapter.BRAND;
    readonly name = 'postgres';
    /**
     * Declares capabilities of this database adapter.
     * Used by the migration runner and query compiler to determine which
     * SQL features can be safely used:
     * - transactionalDDL: Postgres supports DDL inside transactions (safe rollback of schema changes)
     * - concurrentIndex: Supports CREATE INDEX CONCURRENTLY (non-blocking index builds)
     * - validateForeignKeys: Supports deferred FK validation via NOT VALID + VALIDATE CONSTRAINT
     */
    readonly features = {
        transactionalDDL: true,
        concurrentIndex: true,
        validateForeignKeys: true,
    };

    /**
     * Narrow an unknown value to `PostgresAdapter`.
     */
    static isPostgresAdapter(value: unknown): value is PostgresAdapter {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === PostgresAdapter.BRAND
        );
    }

    /**
     * Open a Postgres connection pool and return a client-backed DB abstraction.
     */
    async connect(config: AdapterConfig): Promise<DBClient> {
        const pool = new Pool({
            connectionString: config.url,
            host: config.host,
            port: config.port,
            database: config.database,
            user: config.user,
            password: config.password,
            max: config.maxConnections || 10,
        });

        const client = await pool.connect();
        return new PostgresClient(pool, client);
    }
}
