import { describe, it, expect } from 'vitest';
import { trustedSql } from '@danceroutine/tango-core';
import { MigrationGenerator } from '../MigrationGenerator';
import { InternalOperationKind } from '../../domain/internal/InternalOperationKind';
import type { MigrationOperation } from '../../domain/MigrationOperation';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe(MigrationGenerator, () => {
    const generator = new MigrationGenerator();

    it('identifies matching instances', () => {
        expect(MigrationGenerator.isMigrationGenerator(generator)).toBe(true);
        expect(MigrationGenerator.isMigrationGenerator({})).toBe(false);
    });

    describe(MigrationGenerator.prototype.render, () => {
        it('renders a TABLE_CREATE operation', () => {
            const operations: MigrationOperation[] = [
                {
                    kind: InternalOperationKind.TABLE_CREATE,
                    table: 'users',
                    columns: [
                        { name: 'id', type: 'serial', primaryKey: true, notNull: true },
                        { name: 'email', type: 'text', notNull: true, unique: true },
                        { name: 'created_at', type: 'timestamptz', notNull: true, default: { now: true } },
                    ],
                },
            ];

            const source = generator.render('001_create_users', operations);

            expect(source).toContain(
                "import { Migration, op, trustedSql, type Builder } from '@danceroutine/tango-migrations'"
            );
            expect(source).toContain("id = '001_create_users'");
            expect(source).toContain("op.table('users').create");
            expect(source).toContain('.serial()');
            expect(source).toContain('.primaryKey()');
            expect(source).toContain('.notNull()');
            expect(source).toContain('.text()');
            expect(source).toContain('.unique()');
            expect(source).toContain('.timestamptz()');
            expect(source).toContain('.defaultNow()');
            expect(source).toContain("op.table('users').drop()");
        });

        it('renders a TABLE_DROP operation', () => {
            const operations: MigrationOperation[] = [
                { kind: InternalOperationKind.TABLE_DROP, table: 'old_table', cascade: true },
            ];

            const source = generator.render('002_drop_old', operations);

            expect(source).toContain("op.table('old_table').drop({ cascade: true })");
        });

        it('renders a TABLE_DROP operation without cascade', () => {
            const operations: MigrationOperation[] = [{ kind: InternalOperationKind.TABLE_DROP, table: 'old_table' }];
            const source = generator.render('002b_drop_old', operations);
            expect(source).toContain("op.table('old_table').drop()");
        });

        it('renders a COLUMN_ADD operation', () => {
            const operations: MigrationOperation[] = [
                {
                    kind: InternalOperationKind.COLUMN_ADD,
                    table: 'users',
                    column: { name: 'bio', type: 'text' },
                },
            ];

            const source = generator.render('003_add_bio', operations);

            expect(source).toContain("op.table('users').addColumn('bio', (b) => b.text())");
            expect(source).toContain("op.table('users').dropColumn('bio')");
        });

        it('renders a COLUMN_DROP operation', () => {
            const operations: MigrationOperation[] = [
                { kind: InternalOperationKind.COLUMN_DROP, table: 'users', column: 'legacy_field' },
            ];

            const source = generator.render('004_drop_legacy', operations);

            expect(source).toContain("op.table('users').dropColumn('legacy_field')");
        });

        it('renders a COLUMN_RENAME operation', () => {
            const operations: MigrationOperation[] = [
                { kind: InternalOperationKind.COLUMN_RENAME, table: 'users', from: 'name', to: 'full_name' },
            ];

            const source = generator.render('005_rename_name', operations);

            expect(source).toContain("op.table('users').renameColumn('name', 'full_name')");
            expect(source).toContain("op.table('users').renameColumn('full_name', 'name')");
        });

        it('renders an INDEX_CREATE operation', () => {
            const operations: MigrationOperation[] = [
                {
                    kind: InternalOperationKind.INDEX_CREATE,
                    name: 'users_email_idx',
                    table: 'users',
                    on: ['email'],
                    unique: true,
                    where: trustedSql('deleted_at IS NULL'),
                    concurrently: true,
                },
            ];

            const source = generator.render('006_add_index', operations);

            expect(source).toContain(
                `op.index.create({ name: 'users_email_idx', table: 'users', on: ['email'], unique: true, where: trustedSql(${JSON.stringify('deleted_at IS NULL')}), concurrently: true })`
            );
            expect(source).toContain("op.index.drop({ name: 'users_email_idx', table: 'users' })");
        });

        it('renders a FK_CREATE operation', () => {
            const operations: MigrationOperation[] = [
                {
                    kind: InternalOperationKind.FK_CREATE,
                    table: 'posts',
                    name: 'posts_author_id_fkey',
                    columns: ['author_id'],
                    refTable: 'users',
                    refColumns: ['id'],
                    onDelete: 'CASCADE',
                    onUpdate: 'CASCADE',
                },
            ];

            const source = generator.render('007_add_fk', operations);

            expect(source).toContain('op.foreignKey(');
            expect(source).toContain("table: 'posts'");
            expect(source).toContain("columns: ['author_id']");
            expect(source).toContain("references: { table: 'users', columns: ['id'] }");
            expect(source).toContain("name: 'posts_author_id_fkey'");
            expect(source).toContain("onDelete: 'CASCADE'");
            expect(source).toContain("onUpdate: 'CASCADE'");
        });

        it('renders column with references', () => {
            const operations: MigrationOperation[] = [
                {
                    kind: InternalOperationKind.TABLE_CREATE,
                    table: 'posts',
                    columns: [
                        { name: 'id', type: 'serial', primaryKey: true, notNull: true },
                        {
                            name: 'author_id',
                            type: 'int',
                            notNull: true,
                            references: { table: 'users', column: 'id', onDelete: 'CASCADE' },
                        },
                    ],
                },
            ];

            const source = generator.render('008_posts', operations);

            expect(source).toContain(".references('users', 'id', { onDelete: 'CASCADE' })");
        });

        it('renders multiple operations', () => {
            const operations: MigrationOperation[] = [
                {
                    kind: InternalOperationKind.TABLE_CREATE,
                    table: 'tags',
                    columns: [
                        { name: 'id', type: 'serial', primaryKey: true, notNull: true },
                        { name: 'name', type: 'text', notNull: true },
                    ],
                },
                {
                    kind: InternalOperationKind.INDEX_CREATE,
                    name: 'tags_name_idx',
                    table: 'tags',
                    on: ['name'],
                    unique: true,
                },
            ];

            const source = generator.render('009_tags', operations);

            expect(source).toContain("op.table('tags').create");
            expect(source).toContain('op.index.create');
            expect(source).toContain('op.index.drop');
            expect(source).toContain("op.table('tags').drop()");
        });

        it('renders a COLUMN_ALTER operation', () => {
            const operations: MigrationOperation[] = [
                {
                    kind: InternalOperationKind.COLUMN_ALTER,
                    table: 'users',
                    column: 'email',
                    to: { notNull: true },
                },
            ];

            const source = generator.render('010_alter_email', operations);

            expect(source).toContain("op.table('users').alterColumn('email', { notNull: true })");
        });

        it('generates valid TypeScript module structure', () => {
            const operations: MigrationOperation[] = [
                {
                    kind: InternalOperationKind.TABLE_CREATE,
                    table: 'simple',
                    columns: [{ name: 'id', type: 'serial', primaryKey: true, notNull: true }],
                },
            ];

            const source = generator.render('test_id', operations);

            expect(source).toContain("from '@danceroutine/tango-migrations'");
            expect(source).toContain('export default class Migration_test_id extends Migration {');
            expect(source).toContain('up(m: Builder) {');
            expect(source).toContain('down(m: Builder) {');
            expect(source).toContain('}');
        });

        it('renders fk validate, fk drop, index drop, custom, and unsupported operations', () => {
            const operations: MigrationOperation[] = [
                { kind: InternalOperationKind.FK_VALIDATE, table: 'posts', name: 'posts_author_fkey' },
                { kind: InternalOperationKind.FK_DROP, table: 'posts', name: 'posts_author_fkey' },
                { kind: InternalOperationKind.INDEX_DROP, table: 'posts', name: 'posts_idx' },
                { kind: 'custom', name: 'seed.users', args: { rows: 1 } },
                { kind: 'unknown' as unknown as 'table_create' } as never,
            ];

            const source = generator.render('011_misc', operations);
            expect(source).toContain('op.foreignKeyValidate');
            expect(source).toContain("op.foreignKeyDrop({ table: 'posts', name: 'posts_author_fkey' })");
            expect(source).toContain("op.index.drop({ name: 'posts_idx', table: 'posts' })");
            expect(source).toContain("custom operation 'seed.users'");
            expect(source).toContain('unsupported operation');
            expect(source).toContain('manual reverse required');
            expect(source).toContain('no reverse needed for FK_VALIDATE');
        });

        it('renders alter defaults and references with onUpdate plus generated fk-drop name', () => {
            const operations: MigrationOperation[] = [
                {
                    kind: InternalOperationKind.COLUMN_ALTER,
                    table: 'users',
                    column: 'created_at',
                    to: { type: 'timestamptz', notNull: false, default: null },
                },
                {
                    kind: InternalOperationKind.COLUMN_ALTER,
                    table: 'users',
                    column: 'status',
                    to: { default: trustedSql('active') },
                },
                {
                    kind: InternalOperationKind.COLUMN_ALTER,
                    table: 'users',
                    column: 'updated_at',
                    to: { default: { now: true } },
                },
                {
                    kind: InternalOperationKind.COLUMN_ALTER,
                    table: 'users',
                    column: 'metadata',
                    to: { default: { bogus: true } as unknown as { now: true } },
                },
                {
                    kind: InternalOperationKind.TABLE_CREATE,
                    table: 'events',
                    columns: [
                        {
                            name: 'user_id',
                            type: 'int',
                            references: { table: 'users', column: 'id', onDelete: 'CASCADE', onUpdate: 'CASCADE' },
                        },
                    ],
                },
                {
                    kind: InternalOperationKind.FK_CREATE,
                    table: 'events',
                    columns: ['user_id'],
                    refTable: 'users',
                    refColumns: ['id'],
                    notValid: true,
                },
            ];

            const source = generator.render('012_alter_defaults', operations);
            expect(source).toContain(
                "alterColumn('created_at', { type: 'timestamptz', notNull: false, default: null })"
            );
            expect(source).toContain(`alterColumn('status', { default: trustedSql(${JSON.stringify('active')}) })`);
            expect(source).toContain("alterColumn('updated_at', { default: { now: true } })");
            expect(source).toContain("alterColumn('metadata', {  })");
            expect(source).toContain(".references('users', 'id', { onDelete: 'CASCADE', onUpdate: 'CASCADE' })");
            expect(source).toContain('notValid: true');
            expect(source).toContain("op.foreignKeyDrop({ table: 'events', name: 'events_user_id_fkey' })");
        });

        it('renders column chains for string and null defaults', () => {
            const source = generator.render('013_chain_defaults', [
                {
                    kind: InternalOperationKind.TABLE_CREATE,
                    table: 'settings',
                    columns: [
                        { name: 'theme', type: 'text', default: trustedSql("'light'") },
                        { name: 'deleted_at', type: 'timestamptz', default: null },
                    ],
                },
            ]);
            expect(source).toContain(`.default(trustedSql(${JSON.stringify("'light'")}))`);
            expect(source).toContain('.default(null)');
        });

        it('renders column chains when type is omitted, default object is non-now, and references have no actions', () => {
            const source = generator.render('014_chain_edgecases', [
                {
                    kind: InternalOperationKind.TABLE_CREATE,
                    table: 'edgecases',
                    columns: [
                        // @ts-expect-error - untyped column
                        { name: 'untyped' },
                        { name: 'opaque_default', type: 'text', default: { bogus: true } as unknown as { now: true } },
                        { name: 'user_id', type: 'int', references: { table: 'users', column: 'id' } },
                    ],
                },
            ]);

            expect(source).toContain("cols.add('untyped', (b) => b);");
            expect(source).toContain("cols.add('opaque_default', (b) => b.text());");
            expect(source).toContain(".references('users', 'id')");
        });

        it('renders index create without unique/where/concurrently flags', () => {
            const source = generator.render('015_index_plain', [
                {
                    kind: InternalOperationKind.INDEX_CREATE,
                    table: 'users',
                    name: 'users_plain_idx',
                    on: ['username'],
                },
            ]);
            expect(source).toContain("op.index.create({ name: 'users_plain_idx', table: 'users', on: ['username'] })");
        });
    });

    describe(MigrationGenerator.prototype.generate, () => {
        it('throws when no operations are provided', async () => {
            await expect(
                generator.generate({
                    name: 'empty',
                    operations: [],
                    directory: '/tmp/unused',
                })
            ).rejects.toThrow('No operations to generate');
        });

        it('writes migration files to disk', async () => {
            const dir = await mkdtemp(join(tmpdir(), 'tango-generator-'));
            try {
                const path = await generator.generate({
                    name: 'create_users',
                    operations: [
                        {
                            kind: InternalOperationKind.TABLE_CREATE,
                            table: 'users',
                            columns: [{ name: 'id', type: 'serial', primaryKey: true }],
                        },
                    ],
                    directory: dir,
                });
                const source = await readFile(path, 'utf8');
                expect(path.startsWith(dir)).toBe(true);
                expect(source).toContain('extends Migration');
                expect(source).toContain("op.table('users').create");
            } finally {
                await rm(dir, { recursive: true, force: true });
            }
        });
    });
});
