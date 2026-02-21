import { describe, it, expect } from 'vitest';
import { trustedSql } from '@danceroutine/tango-core';
import { OpBuilder, OpBuilder as op, applyFieldType } from '../OpBuilder';

describe(OpBuilder, () => {
    it('identifies operation builders and returns missing custom operations as undefined', () => {
        expect(OpBuilder.isOpBuilder(new OpBuilder())).toBe(true);
        expect(OpBuilder.isOpBuilder({})).toBe(false);
        expect(OpBuilder.getCustomOperation('missing')).toBeUndefined();
    });

    describe('table operations', () => {
        it('describes a table creation operation', () => {
            const result = op.table('users').create((cols) => {
                cols.add('id', (b) => b.serial().primaryKey());
                cols.add('email', (b) => b.text().notNull());
            });

            expect(result.kind).toBe('table.create');
            expect(result.table).toBe('users');
            expect(result.columns).toHaveLength(2);
            expect(result.columns[0]?.type).toBe('serial');
            expect(result.columns[0]?.primaryKey).toBe(true);
        });

        it('describes a table removal operation', () => {
            const result = op.table('users').drop();

            expect(result.kind).toBe('table.drop');
            expect(result.table).toBe('users');
        });

        it('describes a cascading table removal operation', () => {
            const result = op.table('users').drop({ cascade: true });

            expect(result.kind).toBe('table.drop');
            expect(result.cascade).toBe(true);
        });
    });

    describe('column operations', () => {
        it('describes adding a column to a table', () => {
            const result = op.table('users').addColumn('age', (b) => b.int());

            expect(result.kind).toBe('column.add');
            expect(result.table).toBe('users');
            expect(result.column.name).toBe('age');
            expect(result.column.type).toBe('int');
        });

        it('describes removing a column from a table', () => {
            const result = op.table('users').dropColumn('age');

            expect(result.kind).toBe('column.drop');
            expect(result.table).toBe('users');
            expect(result.column).toBe('age');
        });

        it('describes changing a column definition', () => {
            const result = op.table('users').alterColumn('age', { type: 'bigint' });

            expect(result.kind).toBe('column.alter');
            expect(result.table).toBe('users');
            expect(result.column).toBe('age');
            expect(result.to.type).toBe('bigint');
        });

        it('describes renaming a column', () => {
            const result = op.table('users').renameColumn('email', 'email_address');

            expect(result.kind).toBe('column.rename');
            expect(result.table).toBe('users');
            expect(result.from).toBe('email');
            expect(result.to).toBe('email_address');
        });
    });

    describe('index operations', () => {
        it('describes creating an index', () => {
            const result = op.index.create({
                name: 'users_email_idx',
                table: 'users',
                on: ['email'],
                unique: true,
            });

            expect(result.kind).toBe('index.create');
            expect(result.name).toBe('users_email_idx');
            expect(result.unique).toBe(true);
        });

        it('describes removing an index', () => {
            const result = op.index.drop({
                name: 'users_email_idx',
                table: 'users',
            });

            expect(result.kind).toBe('index.drop');
            expect(result.name).toBe('users_email_idx');
        });
    });

    describe('foreign key operations', () => {
        it('describes creating a foreign key', () => {
            const result = op.foreignKey({
                table: 'posts',
                columns: ['author_id'],
                references: { table: 'users', columns: ['id'] },
                onDelete: 'CASCADE',
            });

            expect(result.kind).toBe('fk.create');
            expect(result.table).toBe('posts');
            expect(result.refTable).toBe('users');
            expect(result.onDelete).toBe('CASCADE');
        });

        it('validates foreign key', () => {
            const result = op.foreignKeyValidate({
                table: 'posts',
                name: 'posts_author_id_fkey',
            });

            expect(result.kind).toBe('fk.validate');
            expect(result.name).toBe('posts_author_id_fkey');
        });

        it('describes removing a foreign key', () => {
            const result = op.foreignKeyDrop({
                table: 'posts',
                name: 'posts_author_id_fkey',
            });

            expect(result.kind).toBe('fk.drop');
            expect(result.name).toBe('posts_author_id_fkey');
        });
    });

    describe('column builder', () => {
        it('identifies column builders created by table operations', () => {
            let captured: unknown;
            op.table('users').addColumn('id', (b) => {
                captured = b;
                return b.serial();
            });

            const ctor = (captured as { constructor?: { isColumnBuilder?: (value: unknown) => boolean } }).constructor;
            expect(ctor?.isColumnBuilder?.(captured)).toBe(true);
            expect(ctor?.isColumnBuilder?.({})).toBe(false);
        });

        it('builds column with all options', () => {
            const result = op.table('users').addColumn('created_at', (b) => b.timestamptz().notNull().defaultNow());

            expect(result.column.type).toBe('timestamptz');
            expect(result.column.notNull).toBe(true);
            expect(result.column.default).toEqual({ now: true });
        });

        it('builds column with literal default and unique flag', () => {
            const result = op
                .table('users')
                .addColumn('email', (builder) => builder.text().notNull().default(trustedSql("'none'")).unique());

            expect(result.column.type).toBe('text');
            expect(result.column.notNull).toBe(true);
            expect(result.column.default).toEqual(trustedSql("'none'"));
            expect(result.column.unique).toBe(true);
        });

        it('builds column with reference', () => {
            const result = op
                .table('posts')
                .addColumn('author_id', (b) => b.int().references('users', 'id', { onDelete: 'CASCADE' }));

            expect(result.column.type).toBe('int');
            expect(result.column.references).toEqual({
                table: 'users',
                column: 'id',
                onDelete: 'CASCADE',
                onUpdate: undefined,
            });
        });

        it('supports boolean, jsonb, and uuid columns', () => {
            const created = op.table('misc').create((cols) => {
                cols.add('flag', (b) => b.bool());
                cols.add('payload', (b) => b.jsonb());
                cols.add('uid', (b) => b.uuid());
            });

            expect(created.columns.map((column) => column.type)).toEqual(['bool', 'jsonb', 'uuid']);
        });

        it('supports bigint columns', () => {
            const result = op.table('metrics').addColumn('counter', (b) => b.bigint());
            expect(result.column.type).toBe('bigint');
        });
    });

    describe('custom operations', () => {
        it('returns registered custom operations by name', () => {
            OpBuilder.registerCustomOperation('seed.users', (args: { rows: number }) => ({
                kind: 'custom',
                name: 'seed.users',
                args,
            }));

            const custom = OpBuilder.getCustomOperation<'seed.users', { rows: number }>('seed.users');
            expect(custom).toBeDefined();
            const operation = custom?.({ rows: 3 });

            expect(operation).toEqual({
                kind: 'custom',
                name: 'seed.users',
                args: { rows: 3 },
            });
        });
    });

    describe(applyFieldType, () => {
        it('selects the matching column builder for each supported field type', () => {
            const createBuilder = () =>
                ({
                    serial: () => 'serial',
                    int: () => 'int',
                    bigint: () => 'bigint',
                    text: () => 'text',
                    bool: () => 'bool',
                    timestamptz: () => 'timestamptz',
                    jsonb: () => 'jsonb',
                    uuid: () => 'uuid',
                }) as unknown as Parameters<typeof applyFieldType>[0];

            expect(applyFieldType(createBuilder(), 'serial')).toBe('serial');
            expect(applyFieldType(createBuilder(), 'int')).toBe('int');
            expect(applyFieldType(createBuilder(), 'bigint')).toBe('bigint');
            expect(applyFieldType(createBuilder(), 'text')).toBe('text');
            expect(applyFieldType(createBuilder(), 'bool')).toBe('bool');
            expect(applyFieldType(createBuilder(), 'timestamptz')).toBe('timestamptz');
            expect(applyFieldType(createBuilder(), 'jsonb')).toBe('jsonb');
            expect(applyFieldType(createBuilder(), 'uuid')).toBe('uuid');
            expect(() => applyFieldType(createBuilder(), 'unknown' as unknown as 'uuid')).toThrow(
                'Unsupported field type'
            );
        });
    });
});
