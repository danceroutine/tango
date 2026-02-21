import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
    Dialect,
    ResetMode,
    TestHarness,
    applyAndVerifyMigrations,
    assertMigrationPlan,
    introspectSchema,
    type IntegrationHarness,
} from '@danceroutine/tango-testing/integration';
import { diffSchema } from '../../diff';
import type { MigrationOperation } from '../../domain';

type ModelMetadataList = Parameters<typeof diffSchema>[1];
type DbSchemaInput = Parameters<typeof diffSchema>[0];

function selectedDialects(): Dialect[] {
    const forced = process.env.TANGO_TEST_DIALECT;
    if (forced === Dialect.Sqlite) return [Dialect.Sqlite];
    if (forced === Dialect.Postgres) return [Dialect.Postgres];

    const hasPostgres =
        !!process.env.TANGO_DATABASE_URL ||
        !!process.env.DATABASE_URL ||
        (!!process.env.TANGO_DB_HOST && !!process.env.TANGO_DB_NAME);

    return hasPostgres ? [Dialect.Sqlite, Dialect.Postgres] : [Dialect.Sqlite];
}

function serializeOpsMigration(id: string, ops: unknown[]): string {
    return `import { Migration } from '../src/domain/index.ts';\nMigration.isMigration({});\nMigration.isMigrationConstructor({});\n\nexport default class Migration_${id} extends Migration {\n  id = '${id}';\n\n  async up(builder) {\n    const ops = ${JSON.stringify(ops)};\n    builder.run(...ops);\n  }\n\n  async down() {\n    // noop for integration fixture migrations\n  }\n}\n`;
}

async function writeMigration(dir: string, id: string, ops: unknown[]): Promise<void> {
    const file = join(dir, `${id}.ts`);
    await writeFile(file, serializeOpsMigration(id, ops), 'utf8');
}

const modelsV1: ModelMetadataList = [
    {
        table: 'users',
        fields: [
            { name: 'id', type: 'serial', primaryKey: true, notNull: true },
            { name: 'email', type: 'text', notNull: true },
            { name: 'created_at', type: 'timestamptz', notNull: true, default: { now: true } },
            { name: 'legacy_code', type: 'text' },
        ],
        indexes: [{ name: 'users_created_idx', on: ['created_at'], unique: false }],
    },
    {
        table: 'posts',
        fields: [
            { name: 'id', type: 'serial', primaryKey: true, notNull: true },
            {
                name: 'author_id',
                type: 'int',
                notNull: true,
                references: { table: 'users', column: 'id', onDelete: 'CASCADE', onUpdate: 'CASCADE' },
            },
            { name: 'title', type: 'text', notNull: true },
        ],
        indexes: [{ name: 'posts_author_idx', on: ['author_id'], unique: false }],
    },
];

const modelsV2: ModelMetadataList = [
    {
        table: 'users',
        fields: [
            { name: 'id', type: 'serial', primaryKey: true, notNull: true },
            { name: 'email', type: 'text', notNull: true },
            { name: 'created_at', type: 'timestamptz', notNull: true, default: { now: true } },
            { name: 'display_name', type: 'text' },
        ],
        indexes: [{ name: 'users_email_idx', on: ['email'], unique: true }],
    },
    {
        table: 'posts',
        fields: [
            { name: 'id', type: 'serial', primaryKey: true, notNull: true },
            {
                name: 'author_id',
                type: 'int',
                notNull: true,
                references: { table: 'users', column: 'id', onDelete: 'CASCADE', onUpdate: 'CASCADE' },
            },
            { name: 'title', type: 'text', notNull: true },
            { name: 'slug', type: 'text', notNull: true },
        ],
        indexes: [{ name: 'posts_slug_idx', on: ['slug'], unique: true }],
    },
];

describe.each(selectedDialects())('Migration manager integration (%s)', (dialect) => {
    let harness: IntegrationHarness;

    beforeAll(async () => {
        harness = await TestHarness.forDialect({ dialect, options: { resetMode: ResetMode.DropSchema } });
        await harness.setup();
    });

    beforeEach(async () => {
        await harness.reset();
    });

    afterAll(async () => {
        await harness.teardown();
    });

    it('generates from real model metadata, applies migrations, and converges schema', async () => {
        const migrationsDir = await mkdtemp(join(process.cwd(), `.tmp-tango-migrations-${dialect}-`));

        try {
            const ops1 = diffSchema({ tables: {} }, modelsV1);
            expect(ops1.some((op) => op.kind === 'table.create' && op.table === 'users')).toBe(true);
            expect(ops1.some((op) => op.kind === 'table.create' && op.table === 'posts')).toBe(true);
            expect(ops1.some((op) => hasAuthorIdWithOnUpdate(op))).toBe(true);

            await writeMigration(migrationsDir, '001_init', ops1);

            const tableCreateSnippets =
                dialect === Dialect.Postgres
                    ? ['CREATE TABLE "users"', 'CREATE TABLE "posts"']
                    : ['CREATE TABLE "users"', 'CREATE TABLE "posts"'];

            await assertMigrationPlan(harness, {
                migrationsDir,
                expectSqlContains: tableCreateSnippets,
            });

            await applyAndVerifyMigrations(harness, {
                migrationsDir,
                expectedAppliedIds: ['001_init'],
            });

            const schemaAfterV1 = (await introspectSchema(harness)) as DbSchemaInput;
            const ops2 = diffSchema(schemaAfterV1, modelsV2);

            expect(
                ops2.some((op) => op.kind === 'column.add' && op.table === 'users' && op.column.name === 'display_name')
            ).toBe(true);
            expect(
                ops2.some((op) => op.kind === 'column.drop' && op.table === 'users' && op.column === 'legacy_code')
            ).toBe(true);
            expect(ops2.some((op) => op.kind === 'index.create' && op.name === 'users_email_idx')).toBe(true);

            await writeMigration(migrationsDir, '002_evolve', ops2);

            await applyAndVerifyMigrations(harness, {
                migrationsDir,
                expectedAppliedIds: ['001_init', '002_evolve'],
            });

            const schemaAfterV2 = (await introspectSchema(harness)) as DbSchemaInput;
            const pending = diffSchema(schemaAfterV2, modelsV2);
            expect(pending).toHaveLength(0);
        } finally {
            await rm(migrationsDir, { recursive: true, force: true });
        }
    });

    it('runs capability-gated dialect checks', async () => {
        if (harness.capabilities.supportsSchemas) {
            const rows = await harness.dbClient.query<{ schema: string }>('SELECT current_schema() as schema');
            expect(rows.rows[0]?.schema.startsWith('tango_test_')).toBe(true);
        } else {
            const rows = await harness.dbClient.query<{ name: string }>(
                "SELECT name FROM sqlite_master WHERE type='table'"
            );
            expect(Array.isArray(rows.rows)).toBe(true);
        }

        expect(harness.capabilities.supportsConcurrentIndex).toBe(dialect === Dialect.Postgres);
        expect(harness.capabilities.supportsDeferredFkValidation).toBe(dialect === Dialect.Postgres);
    });
});

function hasAuthorIdWithOnUpdate(op: MigrationOperation): boolean {
    return (
        op.kind === 'table.create' &&
        op.table === 'posts' &&
        op.columns.some((column) => column.name === 'author_id' && !!column.references?.onUpdate)
    );
}
