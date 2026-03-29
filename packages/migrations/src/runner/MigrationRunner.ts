import { CollectingBuilder } from '../builder/runtime/CollectingBuilder';
import type { Dialect } from '../domain/Dialect';
import { Migration } from '../domain/Migration';
import type { SQL } from '../compilers/contracts/SQL';
import type { MigrationOperation } from '../domain/MigrationOperation';
import type { CompilerStrategy } from '../strategies/CompilerStrategy';
import { createDefaultCompilerStrategy } from '../strategies/CompilerStrategy';
import { InternalDialect } from '../domain/internal/InternalDialect';
import { isError } from '@danceroutine/tango-core';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadDefaultExport } from '../runtime/loadModule';

const JOURNAL = '_tango_migrations';

/** DB client contract required by migration execution. */
interface DBClient {
    /** Execute SQL with optional parameters. */
    query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<{ rows: T[] }>;
    /** Release underlying database resources. */
    close(): Promise<void>;
}

/**
 * Manages the lifecycle of database migrations: applying, planning, and tracking status.
 *
 * The runner reads migration files from a directory, compiles operations to SQL
 * for the target dialect, and maintains a journal table to track which migrations
 * have been applied. Each applied migration is checksummed to detect tampering.
 *
 * @example
 * ```typescript
 * const runner = new MigrationRunner(client, 'postgres', './migrations');
 *
 * // Apply all pending migrations
 * await runner.apply();
 *
 * // Apply up to a specific migration
 * await runner.apply('003_add_indexes');
 *
 * // Preview the SQL that would be generated
 * const sql = await runner.plan();
 *
 * // Check which migrations are applied
 * const statuses = await runner.status();
 * ```
 */
export class MigrationRunner {
    static readonly BRAND = 'tango.migrations.runner' as const;
    readonly __tangoBrand: typeof MigrationRunner.BRAND = MigrationRunner.BRAND;
    private compilerStrategy: CompilerStrategy;

    constructor(
        private client: DBClient,
        private dialect: Dialect,
        private migrationsDir: string = 'migrations',
        compilerStrategy?: CompilerStrategy
    ) {
        this.compilerStrategy = compilerStrategy ?? createDefaultCompilerStrategy();
    }

    /**
     * Narrow an unknown value to `MigrationRunner`.
     */
    static isMigrationRunner(value: unknown): value is MigrationRunner {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === MigrationRunner.BRAND
        );
    }

    /**
     * Apply all pending migrations, optionally stopping at a specific migration ID.
     * Migrations are applied in file-sort order. Already-applied migrations are skipped.
     * Non-online migrations are wrapped in a transaction on Postgres.
     */
    async apply(toId?: string): Promise<void> {
        await this.ensureJournal();
        const applied = await this.listApplied();
        const migrations = await this.loadMigrations();

        for (const migration of migrations) {
            if (toId && migration.id > toId) {
                break;
            }
            if (applied.has(migration.id)) {
                continue;
            }

            await this.applyMigration(migration);
        }
    }

    /**
     * Generate a dry-run SQL plan for all migrations without executing anything.
     * Useful for reviewing what SQL would be run before applying.
     */
    async plan(): Promise<string> {
        const migrations = await this.loadMigrations();
        let output = '';

        migrations.forEach((migration) => {
            const builder = new CollectingBuilder();
            migration.up(builder);
            const sqls = builder.ops.flatMap((op) => this.compileOperation(op));

            output += `# ${migration.id}\n`;
            sqls.forEach((statement) => {
                output += statement.sql + ';\n';
            });
            if (builder.dataFns.length) {
                output += '-- (data step present)\n';
            }
            output += '\n';
        });

        return output;
    }

    /**
     * Return the applied/pending status of every migration found on disk.
     */
    async status(): Promise<{ id: string; applied: boolean }[]> {
        const applied = await this.listApplied();
        const migrations = await this.loadMigrations();

        return migrations.map((m) => ({
            id: m.id,
            applied: applied.has(m.id),
        }));
    }

    private async ensureJournal(): Promise<void> {
        const sql =
            this.dialect === InternalDialect.POSTGRES
                ? `CREATE TABLE IF NOT EXISTS "${JOURNAL}" (
            id TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            checksum TEXT NOT NULL
          )`
                : `CREATE TABLE IF NOT EXISTS ${JOURNAL} (
            id TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now')),
            checksum TEXT NOT NULL
          )`;

        await this.client.query(sql);
    }

    private async listApplied(): Promise<Set<string>> {
        const table = this.dialect === InternalDialect.POSTGRES ? `"${JOURNAL}"` : JOURNAL;
        const { rows } = await this.client.query<{ id: string }>(`SELECT id FROM ${table}`);
        return new Set(rows.map((r) => r.id));
    }

    private async loadMigrations(): Promise<Migration[]> {
        const files = (await readdir(this.migrationsDir)).filter((f) => f.endsWith('.ts') || f.endsWith('.js')).sort();

        const migrations: Migration[] = [];

        for (const file of files) {
            const absolutePath = resolve(this.migrationsDir, file);
            let loaded: unknown;
            try {
                loaded = await loadDefaultExport(absolutePath, { projectRoot: process.cwd() });
            } catch (error) {
                const reason = isError(error) ? error.message : String(error);
                throw new Error(`Failed to load migration module '${file}': ${reason}`, { cause: error });
            }

            if (Migration.isMigration(loaded)) {
                migrations.push(loaded);
                continue;
            }

            if (Migration.isMigrationConstructor(loaded)) {
                migrations.push(new loaded());
                continue;
            }

            throw new Error(
                `Invalid migration module '${file}'. Default export must be a Migration subclass or instance.`
            );
        }

        return migrations;
    }

    private async applyMigration(migration: Migration): Promise<void> {
        const builder = new CollectingBuilder();
        await migration.up(builder);

        const sqls = builder.ops.flatMap((op) => this.compileOperation(op));
        const checksum = String(this.hashJSON(builder.ops));

        const isOnline = (migration.mode ?? builder.getMode()) === 'online';

        if (!isOnline && this.dialect === InternalDialect.POSTGRES) {
            await this.client.query('BEGIN');
        }

        try {
            for (const statement of sqls) {
                await this.client.query(statement.sql, statement.params);
            }

            for (const fn of builder.dataFns) {
                await fn({ query: (sql, params) => this.client.query(sql, params).then(() => {}) });
            }

            const table = this.dialect === InternalDialect.POSTGRES ? `"${JOURNAL}"` : JOURNAL;
            const placeholder = this.dialect === InternalDialect.POSTGRES ? '$1, $2' : '?, ?';
            await this.client.query(`INSERT INTO ${table} (id, checksum) VALUES (${placeholder})`, [
                migration.id,
                checksum,
            ]);

            if (!isOnline && this.dialect === InternalDialect.POSTGRES) {
                await this.client.query('COMMIT');
            }
        } catch (error) {
            if (!isOnline && this.dialect === InternalDialect.POSTGRES) {
                await this.client.query('ROLLBACK');
            }
            throw error;
        }
    }

    /**
     * Compute a simple hash of the migration's operation list.
     * Stored alongside each applied migration in the journal table to detect
     * if a migration file has been modified after it was already applied.
     * Uses a djb2-like hash over the JSON-serialized operations.
     */
    private hashJSON(x: unknown): number {
        const s = JSON.stringify(x);
        let h = 0;
        for (let i = 0; i < s.length; i++) {
            // oxlint-disable-next-line prefer-code-point
            h = Math.imul(31, h) + s.charCodeAt(i);
            // oxlint-disable-next-line prefer-math-trunc
            h = h | 0;
        }
        // oxlint-disable-next-line unicorn/prefer-math-trunc
        return h >>> 0;
    }

    private compileOperation(op: MigrationOperation): SQL[] {
        return this.compilerStrategy.compile(this.dialect, op);
    }
}
