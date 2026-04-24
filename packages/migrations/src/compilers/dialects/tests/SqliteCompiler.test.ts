import { describe, expect, it } from 'vitest';
import { trustedSql } from '@danceroutine/tango-core';
import { SqliteCompiler } from '../SqliteCompiler';
import { InternalOperationKind } from '../../../domain/internal/InternalOperationKind';
import { InternalColumnType } from '../../../domain/internal/InternalColumnType';
import type { MigrationOperation } from '../../../domain/MigrationOperation';

describe(SqliteCompiler, () => {
    it('renders sqlite SQL for table, column, and index changes', () => {
        const compiler = new SqliteCompiler();
        expect(SqliteCompiler.isSqliteCompiler(compiler)).toBe(true);
        expect(SqliteCompiler.isSqliteCompiler({})).toBe(false);

        const create = compiler.compile({
            kind: InternalOperationKind.TABLE_CREATE,
            table: 'users',
            columns: [
                { name: 'id', type: InternalColumnType.SERIAL, primaryKey: true, notNull: true },
                { name: 'email', type: InternalColumnType.TEXT, unique: true, notNull: true },
                {
                    name: 'team_id',
                    type: InternalColumnType.INT,
                    references: { table: 'teams', column: 'id', onDelete: 'CASCADE', onUpdate: 'CASCADE' },
                },
            ],
        });
        expect(create[0]?.sql).toContain('CREATE TABLE "users"');
        expect(create[0]?.sql).toContain('INTEGER PRIMARY KEY AUTOINCREMENT');
        expect(create[0]?.sql).toContain(
            'FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE'
        );

        expect(compiler.compile({ kind: InternalOperationKind.TABLE_DROP, table: 'users' })[0]?.sql).toBe(
            'DROP TABLE "users"'
        );
        expect(
            compiler.compile({
                kind: InternalOperationKind.COLUMN_ADD,
                table: 'users',
                column: { name: 'active', type: InternalColumnType.BOOL, default: trustedSql('1') },
            })[0]?.sql
        ).toContain('ADD COLUMN "active" INTEGER DEFAULT 1');
        expect(
            compiler.compile({
                kind: InternalOperationKind.COLUMN_ADD,
                table: 'users',
                column: { name: 'slug', type: InternalColumnType.TEXT, unique: true },
            })[0]?.sql
        ).not.toContain('UNIQUE');
        expect(
            compiler.compile({
                kind: InternalOperationKind.COLUMN_DROP,
                table: 'users',
                column: 'active',
            })[0]?.sql
        ).toContain('DROP COLUMN "active"');
        expect(
            compiler.compile({
                kind: InternalOperationKind.COLUMN_RENAME,
                table: 'users',
                from: 'full_name',
                to: 'name',
            })[0]?.sql
        ).toContain('RENAME COLUMN "full_name" TO "name"');
        expect(
            compiler.compile({
                kind: InternalOperationKind.INDEX_CREATE,
                name: 'users_email_idx',
                table: 'users',
                on: ['email'],
                unique: true,
                where: trustedSql('deleted_at IS NULL'),
            })[0]?.sql
        ).toContain('CREATE UNIQUE INDEX "users_email_idx" ON "users" ("email") WHERE deleted_at IS NULL');
        expect(
            compiler.compile({ kind: InternalOperationKind.INDEX_DROP, table: 'users', name: 'users_email_idx' })[0]
                ?.sql
        ).toBe('DROP INDEX "users_email_idx"');
    });

    it('returns empty SQL for unsupported sqlite operations and unknown operation kinds', () => {
        const compiler = new SqliteCompiler();
        expect(
            compiler.compile({ kind: InternalOperationKind.COLUMN_ALTER, table: 'users', column: 'name', to: {} })
        ).toEqual([]);
        expect(
            compiler.compile({
                kind: InternalOperationKind.FK_CREATE,
                table: 'users',
                columns: ['team_id'],
                refTable: 'teams',
                refColumns: ['id'],
            })
        ).toEqual([]);
        expect(compiler.compile({ kind: InternalOperationKind.FK_VALIDATE, table: 'users', name: 'fk' })).toEqual([]);
        expect(compiler.compile({ kind: InternalOperationKind.FK_DROP, table: 'users', name: 'fk' })).toEqual([]);
        expect(compiler.compile({ kind: 'unknown' as unknown as 'table_create' } as never)).toEqual([]);
    });

    it('renders all sqlite column type/default combinations', () => {
        const compiler = new SqliteCompiler();
        const create = compiler.compile({
            kind: InternalOperationKind.TABLE_CREATE,
            table: 'types',
            columns: [
                { name: 'i', type: InternalColumnType.INT, notNull: true },
                { name: 'b', type: InternalColumnType.BIGINT },
                { name: 't', type: InternalColumnType.TEXT, default: trustedSql("'x'") },
                { name: 'booly', type: InternalColumnType.BOOL },
                { name: 'ts', type: InternalColumnType.TIMESTAMPTZ, default: { now: true } },
                { name: 'j', type: InternalColumnType.JSONB },
                { name: 'u', type: InternalColumnType.UUID, unique: true },
            ],
        })[0]?.sql;

        expect(create).toContain('"i" INTEGER NOT NULL');
        expect(create).toContain(`"t" TEXT DEFAULT 'x'`);
        expect(create).toContain(`"ts" TEXT DEFAULT (datetime('now'))`);
        expect(create).toContain('"u" TEXT UNIQUE');
    });

    it('adds explicit primary key clause for non-serial primary keys', () => {
        const compiler = new SqliteCompiler();
        const sql = compiler.compile({
            kind: InternalOperationKind.TABLE_CREATE,
            table: 'pk_table',
            columns: [{ name: 'id', type: InternalColumnType.INT, primaryKey: true }],
        })[0]?.sql;

        expect(sql).toContain('PRIMARY KEY ("id")');
    });

    it('renders foreign keys without optional referential actions and rejects untrusted raw defaults', () => {
        const compiler = new SqliteCompiler();
        const sql = compiler.compile({
            kind: InternalOperationKind.TABLE_CREATE,
            table: 'events',
            columns: [
                { name: 'id', type: InternalColumnType.INT, primaryKey: true },
                { name: 'created_at', type: InternalColumnType.TIMESTAMPTZ, default: { now: true } },
                { name: 'user_id', type: InternalColumnType.INT, references: { table: 'users', column: 'id' } },
            ],
        })[0]?.sql;

        expect(sql).toContain(`"created_at" TEXT DEFAULT (datetime('now'))`);
        expect(sql).toContain('FOREIGN KEY ("user_id") REFERENCES "users"("id")');

        expect(() =>
            compiler.compile({
                kind: InternalOperationKind.TABLE_CREATE,
                table: 'events',
                columns: [
                    { name: 'id', type: InternalColumnType.INT, primaryKey: true },
                    {
                        name: 'ignored_default',
                        type: InternalColumnType.TEXT,
                        default: { bogus: true } as unknown as { now: true },
                    },
                ],
            })
        ).toThrow(/untrusted raw sql fragment/i);
    });

    it('passes through a single table create without reordering work', () => {
        const compiler = new SqliteCompiler();
        const ops: MigrationOperation[] = [
            {
                kind: InternalOperationKind.TABLE_CREATE,
                table: 'users',
                columns: [{ name: 'id', type: 'serial', primaryKey: true }],
            },
        ];

        expect(compiler.prepareOperations(ops)).toEqual(ops);
    });

    it('sorts table creates lexicographically when no foreign keys constrain ordering', () => {
        const compiler = new SqliteCompiler();
        const ops: MigrationOperation[] = [
            {
                kind: InternalOperationKind.TABLE_CREATE,
                table: 'zebras',
                columns: [{ name: 'id', type: 'serial', primaryKey: true }],
            },
            {
                kind: InternalOperationKind.TABLE_CREATE,
                table: 'apples',
                columns: [{ name: 'id', type: 'serial', primaryKey: true }],
            },
        ];

        const prepared = compiler.prepareOperations(ops);
        const tables = prepared
            .filter((op) => op.kind === InternalOperationKind.TABLE_CREATE)
            .map((op) => (op.kind === InternalOperationKind.TABLE_CREATE ? op.table : ''));

        expect(tables).toEqual(['apples', 'zebras']);
    });

    it('sorts table creates in lexicographic order when foreign keys form a cycle', () => {
        const compiler = new SqliteCompiler();
        const ops: MigrationOperation[] = [
            {
                kind: InternalOperationKind.TABLE_CREATE,
                table: 'teams',
                columns: [
                    { name: 'id', type: 'serial', primaryKey: true },
                    { name: 'owner_id', type: 'int', references: { table: 'users', column: 'id' } },
                ],
            },
            {
                kind: InternalOperationKind.TABLE_CREATE,
                table: 'users',
                columns: [
                    { name: 'id', type: 'serial', primaryKey: true },
                    { name: 'team_id', type: 'int', references: { table: 'teams', column: 'id' } },
                ],
            },
        ];

        const prepared = compiler.prepareOperations(ops);
        const tables = prepared
            .filter((op) => op.kind === InternalOperationKind.TABLE_CREATE)
            .map((op) => (op.kind === InternalOperationKind.TABLE_CREATE ? op.table : ''));

        expect(tables).toEqual(['teams', 'users']);
    });

    it('treats self-referential foreign keys as non-edges when ordering table creates', () => {
        const compiler = new SqliteCompiler();
        const ops: MigrationOperation[] = [
            {
                kind: InternalOperationKind.TABLE_CREATE,
                table: 'departments',
                columns: [{ name: 'id', type: 'serial', primaryKey: true }],
            },
            {
                kind: InternalOperationKind.TABLE_CREATE,
                table: 'employees',
                columns: [
                    { name: 'id', type: 'serial', primaryKey: true },
                    {
                        name: 'department_id',
                        type: 'int',
                        references: { table: 'departments', column: 'id' },
                    },
                    {
                        name: 'manager_id',
                        type: 'int',
                        references: { table: 'employees', column: 'id' },
                    },
                ],
            },
        ];

        const prepared = compiler.prepareOperations(ops);
        const tables = prepared
            .filter((op) => op.kind === InternalOperationKind.TABLE_CREATE)
            .map((op) => (op.kind === InternalOperationKind.TABLE_CREATE ? op.table : ''));

        expect(tables).toEqual(['departments', 'employees']);
    });

    it('ignores foreign keys that target tables outside the pending create batch', () => {
        const compiler = new SqliteCompiler();
        const ops: MigrationOperation[] = [
            {
                kind: InternalOperationKind.TABLE_CREATE,
                table: 'posts',
                columns: [
                    { name: 'id', type: 'serial', primaryKey: true },
                    {
                        name: 'legacy_account_id',
                        type: 'int',
                        references: { table: 'accounts', column: 'id' },
                    },
                ],
            },
            {
                kind: InternalOperationKind.TABLE_CREATE,
                table: 'users',
                columns: [{ name: 'id', type: 'serial', primaryKey: true }],
            },
        ];

        const prepared = compiler.prepareOperations(ops);
        const tables = prepared
            .filter((op) => op.kind === InternalOperationKind.TABLE_CREATE)
            .map((op) => (op.kind === InternalOperationKind.TABLE_CREATE ? op.table : ''));

        expect(tables).toEqual(['posts', 'users']);
    });

    it('registers dependent tables once per parent while multiple children reference the same parent', () => {
        const compiler = new SqliteCompiler();
        const ops: MigrationOperation[] = [
            {
                kind: InternalOperationKind.TABLE_CREATE,
                table: 'users',
                columns: [{ name: 'id', type: 'serial', primaryKey: true }],
            },
            {
                kind: InternalOperationKind.TABLE_CREATE,
                table: 'posts',
                columns: [
                    { name: 'id', type: 'serial', primaryKey: true },
                    {
                        name: 'author_id',
                        type: 'int',
                        references: { table: 'users', column: 'id' },
                    },
                ],
            },
            {
                kind: InternalOperationKind.TABLE_CREATE,
                table: 'comments',
                columns: [
                    { name: 'id', type: 'serial', primaryKey: true },
                    {
                        name: 'author_id',
                        type: 'int',
                        references: { table: 'users', column: 'id' },
                    },
                ],
            },
        ];

        const prepared = compiler.prepareOperations(ops);
        const tables = prepared
            .filter((op) => op.kind === InternalOperationKind.TABLE_CREATE)
            .map((op) => (op.kind === InternalOperationKind.TABLE_CREATE ? op.table : ''));

        expect(tables).toEqual(['users', 'comments', 'posts']);
    });

    it('delays a child table until every referenced parent exists when two parents are required', () => {
        const compiler = new SqliteCompiler();
        const ops: MigrationOperation[] = [
            {
                kind: InternalOperationKind.TABLE_CREATE,
                table: 'organizations',
                columns: [{ name: 'id', type: 'serial', primaryKey: true }],
            },
            {
                kind: InternalOperationKind.TABLE_CREATE,
                table: 'users',
                columns: [{ name: 'id', type: 'serial', primaryKey: true }],
            },
            {
                kind: InternalOperationKind.TABLE_CREATE,
                table: 'memberships',
                columns: [
                    { name: 'id', type: 'serial', primaryKey: true },
                    {
                        name: 'user_id',
                        type: 'int',
                        references: { table: 'users', column: 'id' },
                    },
                    {
                        name: 'organization_id',
                        type: 'int',
                        references: { table: 'organizations', column: 'id' },
                    },
                ],
            },
        ];

        const prepared = compiler.prepareOperations(ops);
        const tables = prepared
            .filter((op) => op.kind === InternalOperationKind.TABLE_CREATE)
            .map((op) => (op.kind === InternalOperationKind.TABLE_CREATE ? op.table : ''));

        expect(tables).toEqual(['organizations', 'users', 'memberships']);
    });

    it('counts at most one dependency edge per referenced parent table', () => {
        const compiler = new SqliteCompiler();
        const ops: MigrationOperation[] = [
            {
                kind: InternalOperationKind.TABLE_CREATE,
                table: 'posts',
                columns: [
                    { name: 'id', type: 'serial', primaryKey: true },
                    { name: 'author_a_id', type: 'int', references: { table: 'users', column: 'id' } },
                    { name: 'author_b_id', type: 'int', references: { table: 'users', column: 'id' } },
                ],
            },
            {
                kind: InternalOperationKind.TABLE_CREATE,
                table: 'users',
                columns: [{ name: 'id', type: 'serial', primaryKey: true }],
            },
        ];

        const prepared = compiler.prepareOperations(ops);
        expect(prepared[0]?.kind === InternalOperationKind.TABLE_CREATE && prepared[0].table).toBe('users');
        expect(prepared[1]?.kind === InternalOperationKind.TABLE_CREATE && prepared[1].table).toBe('posts');
    });

    it('rewrites unique column adds into add-column plus unique-index operations', () => {
        const compiler = new SqliteCompiler();
        const ops: MigrationOperation[] = [
            {
                kind: InternalOperationKind.COLUMN_ADD,
                table: 'posts',
                column: {
                    name: 'slug',
                    type: 'text',
                    notNull: true,
                    unique: true,
                    default: trustedSql("''"),
                },
            },
        ];

        expect(compiler.prepareOperations(ops)).toEqual([
            {
                kind: InternalOperationKind.COLUMN_ADD,
                table: 'posts',
                column: {
                    name: 'slug',
                    type: 'text',
                    notNull: true,
                    unique: false,
                    default: trustedSql("''"),
                },
            },
            {
                kind: InternalOperationKind.INDEX_CREATE,
                name: 'posts_slug_idx',
                table: 'posts',
                on: ['slug'],
                unique: true,
            },
        ]);
    });

    it('fails early when adding a NOT NULL column without a default', () => {
        const compiler = new SqliteCompiler();
        const ops: MigrationOperation[] = [
            {
                kind: InternalOperationKind.COLUMN_ADD,
                table: 'posts',
                column: {
                    name: 'slug',
                    type: 'text',
                    notNull: true,
                },
            },
        ];

        expect(() => compiler.prepareOperations(ops)).toThrow(/cannot add not null column 'slug'/i);
    });
});
