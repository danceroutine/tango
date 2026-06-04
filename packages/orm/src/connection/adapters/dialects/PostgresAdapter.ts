import type { Adapter, AdapterConfig, SqlPlaceholders } from '../Adapter';
import type { DBClient } from '../../clients/DBClient';
import { PostgresClient } from '../../clients/dialects/PostgresClient';
import { PostgresPoolProvider } from '../../clients/dialects/PostgresPoolProvider';
import { InternalDialect } from '../../../query/domain/internal/InternalDialect';

/**
 * Postgres adapter that turns adapter config into a transactional `DBClient`.
 */
export class PostgresAdapter implements Adapter {
    static readonly BRAND = 'tango.orm.postgres_adapter' as const;
    readonly __tangoBrand: typeof PostgresAdapter.BRAND = PostgresAdapter.BRAND;
    readonly name = 'postgres';
    readonly dialect: Adapter['dialect'] = InternalDialect.POSTGRES;

    /**
     * Declares capabilities of this database adapter.
     * Used by the migration runner and query compiler to determine which
     * SQL features can be safely used:
     * - transactionalDDL: Postgres supports DDL inside transactions (safe rollback of schema changes)
     * - concurrentIndex: Supports CREATE INDEX CONCURRENTLY (non-blocking index builds)
     * - validateForeignKeys: Supports deferred FK validation via NOT VALID + VALIDATE CONSTRAINT
     * - ignoreDuplicateInsert: Supports duplicate-safe insert semantics for manager-owned link writes
     */
    readonly features: Adapter['features'] = {
        transactionalDDL: true,
        concurrentIndex: true,
        validateForeignKeys: true,
        ignoreDuplicateInsert: true,
    };
    readonly placeholders: SqlPlaceholders = {
        at(index: number): string {
            return `$${index}`;
        },
        list(count: number): string {
            return this.listFromOffset(count, 0);
        },
        listFromOffset(count: number, startOffset: number): string {
            return Array.from({ length: count }, (_value, index) => `$${startOffset + index + 1}`).join(', ');
        },
    };
    private readonly poolProvider = new PostgresPoolProvider();

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
        const pool = await this.poolProvider.createPool(config);
        const client = await pool.connect();
        return new PostgresClient(client);
    }
}
