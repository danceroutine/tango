import { rm } from 'node:fs/promises';
import { quoteSqlIdentifier, validateSqlIdentifier } from '@danceroutine/tango-core';
import { MigrationRunner } from '@danceroutine/tango-migrations';
import type { Dialect as MigrationDialect } from '@danceroutine/tango-migrations';
import { SqliteAdapter } from '@danceroutine/tango-orm/connection';
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
 * Harness strategy for SQLite-backed integration tests.
 */
export class SqliteHarnessStrategy implements HarnessStrategy {
    static readonly BRAND = 'tango.testing.sqlite_harness_strategy' as const;
    readonly __tangoBrand: typeof SqliteHarnessStrategy.BRAND = SqliteHarnessStrategy.BRAND;
    readonly dialect: Dialect = Dialect.Sqlite;
    readonly capabilities: DialectTestCapabilities = {
        transactionalDDL: true,
        supportsSchemas: false,
        supportsConcurrentIndex: false,
        supportsDeferredFkValidation: false,
        supportsJsonb: false,
    };

    /**
     * Narrow an unknown value to the SQLite integration harness strategy.
     */
    static isSqliteHarnessStrategy(value: unknown): value is SqliteHarnessStrategy {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === SqliteHarnessStrategy.BRAND
        );
    }

    private static async dropAllTables(client: DBClient): Promise<void> {
        const { rows } = await client.query<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        );
        for (const row of rows) {
            const table = quoteSqlIdentifier(validateSqlIdentifier(String(row.name), 'table'), 'sqlite');
            await client.query(`DROP TABLE IF EXISTS ${table}`);
        }
    }

    /**
     * Create a configured SQLite integration harness instance.
     */
    async create(options: HarnessOptions = {}): Promise<IntegrationHarness> {
        const config = resolveAdapterConfig(Dialect.Sqlite, {
            config: options.config,
            tangoConfigLoader: options.tangoConfigLoader,
            sqliteFile: options.sqliteFile,
        });

        const adapter = new SqliteAdapter();
        const resetMode = options.resetMode ?? ResetMode.DropSchema;
        let client: DBClient | null = null;

        const reconnect = async (): Promise<DBClient> => {
            client = await adapter.connect(config);
            return client;
        };

        const harness: IntegrationHarness = {
            dialect: Dialect.Sqlite,
            capabilities: this.capabilities,
            resetMode,
            get dbClient(): DBClient {
                if (!client) {
                    throw new Error('Sqlite harness not initialized. Call setup() first.');
                }
                return client;
            },
            async setup(): Promise<void> {
                await reconnect();
            },
            async reset(): Promise<void> {
                if (!client) {
                    throw new Error('Sqlite harness not initialized. Call setup() first.');
                }

                if (resetMode === ResetMode.DropSchema && config.filename && config.filename !== ':memory:') {
                    await client.close();
                    await rm(config.filename, { force: true });
                    await reconnect();
                    return;
                }

                await SqliteHarnessStrategy.dropAllTables(client);
            },
            async teardown(): Promise<void> {
                if (client) {
                    await client.close();
                    client = null;
                }
                if (config.filename && config.filename !== ':memory:') {
                    await rm(config.filename, { force: true });
                }
            },
            migrationRunner(migrationsDir: string): MigrationRunner {
                if (!client) {
                    throw new Error('Sqlite harness not initialized. Call setup() first.');
                }
                return new MigrationRunner(client, 'sqlite' as MigrationDialect, migrationsDir);
            },
        };

        return harness;
    }
}
