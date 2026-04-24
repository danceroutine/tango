import { quoteSqlIdentifier, validateSqlIdentifier } from '@danceroutine/tango-core';
import { MigrationRunner } from '@danceroutine/tango-migrations';
import type { Dialect as MigrationDialect } from '@danceroutine/tango-migrations';
import { PostgresAdapter } from '@danceroutine/tango-orm/connection';
import type { DBClient } from '@danceroutine/tango-orm';
import { resolveAdapterConfig } from '../config';
import {
    Dialect,
    ResetMode,
    type DialectTestCapabilities,
    type HarnessOptions,
    type HarnessStrategy,
    type IntegrationHarness,
} from '../domain';

/**
 * Harness strategy for PostgreSQL-backed integration tests.
 */
export class PostgresHarnessStrategy implements HarnessStrategy {
    static readonly BRAND = 'tango.testing.postgres_harness_strategy' as const;
    readonly __tangoBrand: typeof PostgresHarnessStrategy.BRAND = PostgresHarnessStrategy.BRAND;
    readonly dialect: Dialect = Dialect.Postgres;
    readonly capabilities: DialectTestCapabilities = {
        transactionalDDL: true,
        supportsSchemas: true,
        supportsConcurrentIndex: true,
        supportsDeferredFkValidation: true,
        supportsJsonb: true,
    };

    /**
     * Narrow an unknown value to the PostgreSQL integration harness strategy.
     */
    static isPostgresHarnessStrategy(value: unknown): value is PostgresHarnessStrategy {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === PostgresHarnessStrategy.BRAND
        );
    }

    private static buildSchemaName(explicitSchema?: string): string {
        if (explicitSchema) return explicitSchema;
        const random = Math.random().toString(36).slice(2, 8);
        return `tango_test_${Date.now()}_${random}`;
    }

    /**
     * Create a configured Postgres integration harness instance.
     */
    async create(options: HarnessOptions = {}): Promise<IntegrationHarness> {
        const config = resolveAdapterConfig(Dialect.Postgres, {
            config: options.config,
            tangoConfigLoader: options.tangoConfigLoader,
        });

        const adapter = new PostgresAdapter();
        const schemaName = PostgresHarnessStrategy.buildSchemaName(options.schema);
        const resetMode = options.resetMode ?? ResetMode.DropSchema;
        let client: DBClient | null = null;

        const ensureSearchPath = async (): Promise<void> => {
            const dbClient = client as DBClient;
            const schema = quoteSqlIdentifier(validateSqlIdentifier(schemaName, 'schema'), 'postgres');
            await dbClient.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
            await dbClient.query(`SET search_path TO ${schema}`);
        };

        const recreateSchema = async (): Promise<void> => {
            const dbClient = client as DBClient;
            const schema = quoteSqlIdentifier(validateSqlIdentifier(schemaName, 'schema'), 'postgres');
            await dbClient.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
            await dbClient.query(`CREATE SCHEMA ${schema}`);
            await dbClient.query(`SET search_path TO ${schema}`);
        };

        const harness: IntegrationHarness = {
            dialect: Dialect.Postgres,
            adapter,
            capabilities: this.capabilities,
            resetMode,
            get dbClient(): DBClient {
                if (!client) {
                    throw new Error('Postgres harness not initialized. Call setup() first.');
                }
                return client;
            },
            async setup(): Promise<void> {
                client = await adapter.connect(config);
                await ensureSearchPath();
            },
            async reset(): Promise<void> {
                if (!client) {
                    throw new Error('Postgres harness not initialized. Call setup() first.');
                }
                if (resetMode === ResetMode.DropSchema || resetMode === ResetMode.Transaction) {
                    await recreateSchema();
                    return;
                }

                const { rows } = await client.query<{ table_name: string }>(
                    `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
                    [schemaName]
                );
                for (const row of rows) {
                    const schema = quoteSqlIdentifier(validateSqlIdentifier(schemaName, 'schema'), 'postgres');
                    const table = quoteSqlIdentifier(
                        validateSqlIdentifier(String(row.table_name), 'table'),
                        'postgres'
                    );
                    await client.query(`TRUNCATE TABLE ${schema}.${table} RESTART IDENTITY CASCADE`);
                }
                await client.query(
                    `SET search_path TO ${quoteSqlIdentifier(validateSqlIdentifier(schemaName, 'schema'), 'postgres')}`
                );
            },
            async teardown(): Promise<void> {
                if (!client) return;
                try {
                    await client.query(
                        `DROP SCHEMA IF EXISTS ${quoteSqlIdentifier(validateSqlIdentifier(schemaName, 'schema'), 'postgres')} CASCADE`
                    );
                } finally {
                    await client.close();
                    client = null;
                }
            },
            migrationRunner(migrationsDir: string): MigrationRunner {
                if (!client) {
                    throw new Error('Postgres harness not initialized. Call setup() first.');
                }
                return new MigrationRunner(client, 'postgres' as MigrationDialect, migrationsDir);
            },
        };

        return harness;
    }
}
