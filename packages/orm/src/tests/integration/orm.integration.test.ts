import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
    Dialect,
    ResetMode,
    TestHarness,
    applyAndVerifyMigrations,
    createQuerySetFixture,
    expectQueryResult,
    seedTable,
    type IntegrationHarness,
} from '@danceroutine/tango-testing/integration';
import { diffSchema } from '@danceroutine/tango-migrations';

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
    return `import { Migration } from '@danceroutine/tango-migrations';\n\nexport default class Migration_${id} extends Migration {\n  id = '${id}';\n\n  async up(builder) {\n    const ops = ${JSON.stringify(ops)};\n    builder.run(...ops);\n  }\n\n  async down() {\n    // noop for integration fixture migrations\n  }\n}\n`;
}

async function writeMigration(dir: string, id: string, ops: unknown[]): Promise<void> {
    const file = join(dir, `${id}.js`);
    await writeFile(file, serializeOpsMigration(id, ops), 'utf8');
}

type PostRow = {
    id: number;
    title: string;
    slug: string;
    published: boolean;
    created_at: string;
};

type ModelMetadataList = Parameters<typeof diffSchema>[1];

const postModel: ModelMetadataList = [
    {
        table: 'posts',
        fields: [
            { name: 'id', type: 'serial', primaryKey: true, notNull: true },
            { name: 'title', type: 'text', notNull: true },
            { name: 'slug', type: 'text', notNull: true },
            { name: 'published', type: 'bool', notNull: true, default: 'false' },
            { name: 'created_at', type: 'timestamptz', notNull: true, default: { now: true } },
        ],
        indexes: [{ name: 'posts_slug_idx', on: ['slug'], unique: true }],
    },
];

describe.each(selectedDialects())('ORM integration (%s)', (dialect) => {
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

    it('queries migrated data through a query set fixture', async () => {
        const migrationsDir = await mkdtemp(join(tmpdir(), `tango-orm-${dialect}-`));

        try {
            const initOps = diffSchema({ tables: {} }, postModel);
            await writeMigration(migrationsDir, '001_posts', initOps);
            await applyAndVerifyMigrations(harness, {
                migrationsDir,
                expectedAppliedIds: ['001_posts'],
            });

            await seedTable<PostRow>(harness, 'posts', [
                {
                    id: 1,
                    title: 'First',
                    slug: 'first',
                    published: true,
                    created_at: '2024-01-01T00:00:00.000Z',
                },
                {
                    id: 2,
                    title: 'Second',
                    slug: 'second',
                    published: false,
                    created_at: '2024-01-02T00:00:00.000Z',
                },
                {
                    id: 3,
                    title: 'Third',
                    slug: 'third',
                    published: true,
                    created_at: '2024-01-03T00:00:00.000Z',
                },
            ]);

            const queryset = createQuerySetFixture<PostRow>({
                harness,
                meta: {
                    table: 'posts',
                    pk: 'id',
                    columns: {
                        id: 'int',
                        title: 'text',
                        slug: 'text',
                        published: 'bool',
                        created_at: 'timestamptz',
                    },
                },
            });

            const published = await queryset.filter({ published: true }).orderBy('-id').fetch();
            await expectQueryResult(Promise.resolve(published.results.map((row: PostRow) => row.id)), [3, 1]);

            const first = await queryset.filter({ slug: 'first' }).fetchOne();
            expect(first?.title).toBe('First');

            const projected = await queryset
                .filter({ published: true })
                .orderBy('id')
                .select(['id', 'slug'] as const)
                .fetch();
            expect(projected.results).toEqual([
                { id: 1, slug: 'first' },
                { id: 3, slug: 'third' },
            ]);

            const shaped = await queryset
                .filter({ published: true })
                .orderBy('id')
                .select(['id', 'slug'] as const)
                .fetch({
                    parse: (row) => `${row.id}:${row.slug}`,
                });
            expect(shaped.results).toEqual(['1:first', '3:third']);

            const count = await queryset.count();
            expect(count).toBe(3);
        } finally {
            await rm(migrationsDir, { recursive: true, force: true });
        }
    });

    it('runs capability-gated SQL assertions', async () => {
        if (harness.capabilities.supportsJsonb) {
            await harness.dbClient.query(
                'CREATE TABLE capability_jsonb (id SERIAL PRIMARY KEY, payload JSONB NOT NULL)'
            );
            await harness.dbClient.query('INSERT INTO capability_jsonb (payload) VALUES ($1::jsonb)', ['{"ok":true}']);
            const rows = await harness.dbClient.query<{ payload: unknown }>(
                'SELECT payload FROM capability_jsonb ORDER BY id LIMIT 1'
            );
            expect(rows.rows).toHaveLength(1);
        } else {
            expect(harness.capabilities.supportsJsonb).toBe(false);
            const rows = await harness.dbClient.query<{ name: string }>(
                "SELECT name FROM sqlite_master WHERE type='table'"
            );
            expect(Array.isArray(rows.rows)).toBe(true);
        }
    });
});
