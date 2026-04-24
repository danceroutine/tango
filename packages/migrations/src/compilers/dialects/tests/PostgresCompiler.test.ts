import { describe, expect, it } from 'vitest';
import { trustedSql } from '@danceroutine/tango-core';
import { PostgresCompiler } from '../PostgresCompiler';
import { InternalOperationKind } from '../../../domain/internal/InternalOperationKind';
import { InternalColumnType } from '../../../domain/internal/InternalColumnType';
import type { MigrationOperation } from '../../../domain/MigrationOperation';

describe(PostgresCompiler, () => {
    it('identifies matching instances', () => {
        const compiler = new PostgresCompiler();
        expect(PostgresCompiler.isPostgresCompiler(compiler)).toBe(true);
        expect(PostgresCompiler.isPostgresCompiler({})).toBe(false);
    });

    it('compiles create/drop table and column operations', () => {
        const compiler = new PostgresCompiler();
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
        expect(create[0]?.sql).toContain('PRIMARY KEY ("id")');
        expect(create[0]?.sql).toContain('ON DELETE CASCADE');
        expect(create[0]?.sql).toContain('ON UPDATE CASCADE');

        expect(
            compiler.compile({
                kind: InternalOperationKind.TABLE_DROP,
                table: 'users',
                cascade: true,
            })[0]?.sql
        ).toContain('DROP TABLE "users" CASCADE');
        expect(
            compiler.compile({
                kind: InternalOperationKind.TABLE_DROP,
                table: 'users',
            })[0]?.sql
        ).toContain('DROP TABLE "users"');

        expect(
            compiler.compile({
                kind: InternalOperationKind.COLUMN_ADD,
                table: 'users',
                column: { name: 'active', type: InternalColumnType.BOOL, default: trustedSql('true') },
            })[0]?.sql
        ).toContain('ADD COLUMN "active" BOOLEAN DEFAULT true');

        expect(
            compiler.compile({
                kind: InternalOperationKind.COLUMN_DROP,
                table: 'users',
                column: 'active',
            })[0]?.sql
        ).toContain('DROP COLUMN "active"');

        const createWithoutPkOrReferences = compiler.compile({
            kind: InternalOperationKind.TABLE_CREATE,
            table: 'logs',
            columns: [{ name: 'message', type: InternalColumnType.TEXT }],
        });
        expect(createWithoutPkOrReferences[0]?.sql).toContain('CREATE TABLE "logs"');

        const createWithMixedReferenceActions = compiler.compile({
            kind: InternalOperationKind.TABLE_CREATE,
            table: 'assignments',
            columns: [
                {
                    name: 'user_id',
                    type: InternalColumnType.INT,
                    references: { table: 'users', column: 'id', onUpdate: 'CASCADE' },
                },
            ],
        });
        expect(createWithMixedReferenceActions[0]?.sql).toContain('ON UPDATE CASCADE');
        expect(createWithMixedReferenceActions[0]?.sql).not.toContain('ON DELETE');

        const createWithDeleteOnlyReferenceAction = compiler.compile({
            kind: InternalOperationKind.TABLE_CREATE,
            table: 'comments',
            columns: [
                {
                    name: 'post_id',
                    type: InternalColumnType.INT,
                    references: { table: 'posts', column: 'id', onDelete: 'CASCADE' },
                },
            ],
        });
        expect(createWithDeleteOnlyReferenceAction[0]?.sql).toContain('ON DELETE CASCADE');
        expect(createWithDeleteOnlyReferenceAction[0]?.sql).not.toContain('ON UPDATE');
    });

    it('compiles alter/rename/index/fk operations', () => {
        const compiler = new PostgresCompiler();
        const alter = compiler.compile({
            kind: InternalOperationKind.COLUMN_ALTER,
            table: 'users',
            column: 'name',
            to: { type: InternalColumnType.TEXT, notNull: false, default: { now: true } },
        });
        expect(alter.some((entry) => entry.sql.includes('ALTER COLUMN "name" TYPE TEXT'))).toBe(true);
        expect(alter.some((entry) => entry.sql.includes('DROP NOT NULL'))).toBe(true);
        expect(alter.some((entry) => entry.sql.includes('SET DEFAULT now()'))).toBe(true);

        const alterSetNotNull = compiler.compile({
            kind: InternalOperationKind.COLUMN_ALTER,
            table: 'users',
            column: 'name',
            to: { notNull: true },
        });
        expect(alterSetNotNull[0]?.sql).toContain('SET NOT NULL');

        const dropDefault = compiler.compile({
            kind: InternalOperationKind.COLUMN_ALTER,
            table: 'users',
            column: 'created_at',
            to: { default: null },
        });
        expect(dropDefault[0]?.sql).toContain('DROP DEFAULT');

        const stringDefault = compiler.compile({
            kind: InternalOperationKind.COLUMN_ALTER,
            table: 'users',
            column: 'status',
            to: { default: trustedSql("'active'") },
        });
        expect(stringDefault[0]?.sql).toContain("SET DEFAULT 'active'");

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
                concurrently: true,
                where: trustedSql('deleted_at IS NULL'),
            })[0]?.sql
        ).toContain('CREATE UNIQUE INDEX CONCURRENTLY "users_email_idx" ON "users" ("email") WHERE deleted_at IS NULL');
        expect(
            compiler.compile({
                kind: InternalOperationKind.INDEX_CREATE,
                name: 'users_name_idx',
                table: 'users',
                on: ['name'],
            })[0]?.sql
        ).toContain('CREATE INDEX "users_name_idx" ON "users" ("name")');

        expect(
            compiler.compile({
                kind: InternalOperationKind.INDEX_DROP,
                table: 'users',
                name: 'users_email_idx',
                concurrently: true,
            })[0]?.sql
        ).toContain('DROP INDEX CONCURRENTLY "users_email_idx"');
        expect(
            compiler.compile({
                kind: InternalOperationKind.INDEX_DROP,
                table: 'users',
                name: 'users_email_idx',
            })[0]?.sql
        ).toContain('DROP INDEX "users_email_idx"');

        expect(
            compiler.compile({
                kind: InternalOperationKind.FK_CREATE,
                table: 'users',
                columns: ['team_id'],
                refTable: 'teams',
                refColumns: ['id'],
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
                notValid: true,
            })[0]?.sql
        ).toContain('NOT VALID');
        expect(
            compiler.compile({
                kind: InternalOperationKind.FK_CREATE,
                table: 'users',
                columns: ['team_id'],
                refTable: 'teams',
                refColumns: ['id'],
            })[0]?.sql
        ).toContain('REFERENCES "teams" ("id")');

        expect(
            compiler.compile({
                kind: InternalOperationKind.FK_VALIDATE,
                table: 'users',
                name: 'users_team_id_fkey',
            })[0]?.sql
        ).toContain('VALIDATE CONSTRAINT');

        expect(
            compiler.compile({
                kind: InternalOperationKind.FK_DROP,
                table: 'users',
                name: 'users_team_id_fkey',
            })[0]?.sql
        ).toContain('DROP CONSTRAINT');
    });

    it('handles unsupported/default branches', () => {
        const compiler = new PostgresCompiler();

        expect(
            compiler.compile({
                kind: 'unknown_op' as unknown as 'table_create',
            } as never)
        ).toEqual([]);

        expect(
            compiler.compile({
                kind: InternalOperationKind.COLUMN_ALTER,
                table: 'users',
                column: 'name',
                to: { default: 123 as never },
            })
        ).toEqual([]);

        expect(() =>
            compiler.compile({
                kind: InternalOperationKind.COLUMN_ALTER,
                table: 'users',
                column: 'name',
                to: { type: 'weird' as unknown as 'text' },
            })
        ).toThrow('Unsupported column type');
    });

    it('maps all postgres column types in alter operations and column DDL', () => {
        const compiler = new PostgresCompiler();
        const allTypes = [
            InternalColumnType.SERIAL,
            InternalColumnType.INT,
            InternalColumnType.BIGINT,
            InternalColumnType.TEXT,
            InternalColumnType.BOOL,
            InternalColumnType.TIMESTAMPTZ,
            InternalColumnType.JSONB,
            InternalColumnType.UUID,
        ];

        for (const type of allTypes) {
            const out = compiler.compile({
                kind: InternalOperationKind.COLUMN_ALTER,
                table: 'typed',
                column: 'value',
                to: { type },
            });
            expect(out[0]?.sql).toContain('ALTER TABLE "typed" ALTER COLUMN "value" TYPE');
        }

        const create = compiler.compile({
            kind: InternalOperationKind.TABLE_CREATE,
            table: 'typed',
            columns: [
                { name: 'id', type: InternalColumnType.SERIAL, primaryKey: true },
                { name: 'a', type: InternalColumnType.INT },
                { name: 'b', type: InternalColumnType.BIGINT },
                { name: 'c', type: InternalColumnType.TEXT, default: null },
                { name: 'd', type: InternalColumnType.BOOL },
                { name: 'e', type: InternalColumnType.TIMESTAMPTZ, default: { now: true } },
                { name: 'f', type: InternalColumnType.JSONB },
                { name: 'g', type: InternalColumnType.UUID },
            ],
        });
        expect(create[0]?.sql).toContain('"c" TEXT');
        expect(create[0]?.sql).toContain('"e" TIMESTAMPTZ DEFAULT now()');

        expect(() =>
            compiler.compile({
                kind: InternalOperationKind.TABLE_CREATE,
                table: 'typed',
                columns: [
                    { name: 'id', type: InternalColumnType.SERIAL, primaryKey: true },
                    {
                        name: 'h',
                        type: InternalColumnType.TEXT,
                        default: { bogus: true } as unknown as { now: true },
                    },
                ],
            })
        ).toThrow(/untrusted raw sql fragment/i);
    });

    it('sorts table creates lexicographically when no foreign keys are present', () => {
        const compiler = new PostgresCompiler();
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

    it('preserves non-table operations after prepared postgres create batches', () => {
        const compiler = new PostgresCompiler();
        const ops: MigrationOperation[] = [
            {
                kind: InternalOperationKind.TABLE_CREATE,
                table: 'comments',
                columns: [{ name: 'id', type: 'serial', primaryKey: true }],
            },
            {
                kind: InternalOperationKind.INDEX_CREATE,
                name: 'comments_id_idx',
                table: 'comments',
                on: ['id'],
            },
        ];

        const prepared = compiler.prepareOperations(ops);
        expect(prepared[0]?.kind).toBe(InternalOperationKind.TABLE_CREATE);
        expect(prepared[1]?.kind).toBe(InternalOperationKind.INDEX_CREATE);
    });

    it('moves inline foreign keys out of table creates during preparation', () => {
        const compiler = new PostgresCompiler();
        const ops: MigrationOperation[] = [
            {
                kind: InternalOperationKind.TABLE_CREATE,
                table: 'comments',
                columns: [
                    { name: 'id', type: 'serial', primaryKey: true },
                    {
                        name: 'post_id',
                        type: 'int',
                        notNull: true,
                        references: { table: 'posts', column: 'id', onDelete: 'CASCADE', onUpdate: 'CASCADE' },
                    },
                ],
            },
        ];

        const prepared = compiler.prepareOperations(ops);
        const create = prepared.find((op) => op.kind === InternalOperationKind.TABLE_CREATE);
        const fk = prepared.find((op) => op.kind === InternalOperationKind.FK_CREATE);

        expect(
            create?.kind === InternalOperationKind.TABLE_CREATE &&
                create.columns.some((column) => column.name === 'post_id' && !column.references)
        ).toBe(true);
        expect(fk?.kind === InternalOperationKind.FK_CREATE && fk.refTable === 'posts').toBe(true);
    });
});
