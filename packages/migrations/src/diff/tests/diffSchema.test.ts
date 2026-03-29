import { describe, it, expect } from 'vitest';
import { isTrustedSqlFragment } from '@danceroutine/tango-core';
import { diffSchema } from '../diffSchema';
import type { DbSchema } from '../../introspect/PostgresIntrospector';

type Models = Parameters<typeof diffSchema>[1];

describe(diffSchema, () => {
    it('generates create table for new model', () => {
        const dbSchema: DbSchema = { tables: {} };
        const models = [
            {
                name: 'User',
                table: 'users',
                fields: [
                    {
                        name: 'id',
                        type: 'serial',
                        primaryKey: true,
                        notNull: true,
                        unique: false,
                        default: undefined,
                    },
                    {
                        name: 'email',
                        type: 'text',
                        primaryKey: false,
                        notNull: true,
                        unique: true,
                        default: undefined,
                    },
                ],
                indexes: [],
            },
        ];

        const ops = diffSchema(dbSchema, models as Models);

        expect(ops).toHaveLength(1);
        expect(ops[0]?.kind).toBe('table.create');
        expect(ops[0]?.kind === 'table.create' && ops[0].table).toBe('users');
    });

    it('generates table create references and indexes for brand-new tables', () => {
        const dbSchema: DbSchema = { tables: {} };
        const models = [
            {
                name: 'Comment',
                table: 'comments',
                fields: [
                    { name: 'id', type: 'serial', primaryKey: true, notNull: true },
                    {
                        name: 'author_id',
                        type: 'int',
                        notNull: true,
                        references: {
                            table: 'users',
                            column: 'id',
                            onDelete: 'CASCADE',
                            onUpdate: 'CASCADE',
                        },
                    },
                ],
                indexes: [{ name: 'comments_author_idx', on: ['author_id'], unique: false }],
            },
        ];

        const ops = diffSchema(dbSchema, models as Models);
        const create = ops.find((operation) => operation.kind === 'table.create');
        const indexCreate = ops.find((operation) => operation.kind === 'index.create');

        expect(create?.kind).toBe('table.create');
        if (create?.kind === 'table.create') {
            const authorId = create.columns.find((column) => column.name === 'author_id');
            expect(authorId?.references).toEqual({
                table: 'users',
                column: 'id',
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            });
        }
        expect(indexCreate?.kind).toBe('index.create');
    });

    it('generates add column for missing field', () => {
        const dbSchema: DbSchema = {
            tables: {
                users: {
                    name: 'users',
                    columns: {
                        id: {
                            name: 'id',
                            type: 'integer',
                            notNull: true,
                            default: null,
                            isPk: true,
                            isUnique: false,
                        },
                    },
                    pks: ['id'],
                    indexes: {},
                    fks: {},
                },
            },
        };

        const models = [
            {
                name: 'User',
                table: 'users',
                fields: [
                    {
                        name: 'id',
                        type: 'serial',
                        primaryKey: true,
                        notNull: true,
                        unique: false,
                        default: undefined,
                    },
                    {
                        name: 'email',
                        type: 'text',
                        primaryKey: false,
                        notNull: true,
                        unique: false,
                        default: undefined,
                    },
                ],
                indexes: [],
            },
        ];

        const ops = diffSchema(dbSchema, models as Models);

        expect(ops.some((op) => op.kind === 'column.add' && op.column.name === 'email')).toBe(true);
    });

    it('generates add column with defaults, constraints, and references', () => {
        const dbSchema: DbSchema = {
            tables: {
                users: {
                    name: 'users',
                    columns: {
                        id: {
                            name: 'id',
                            type: 'integer',
                            notNull: true,
                            default: null,
                            isPk: true,
                            isUnique: false,
                        },
                    },
                    pks: ['id'],
                    indexes: {},
                    fks: {},
                },
            },
        };

        const models = [
            {
                name: 'User',
                table: 'users',
                fields: [
                    { name: 'id', type: 'serial', primaryKey: true, notNull: true },
                    {
                        name: 'team_id',
                        type: 'int',
                        notNull: true,
                        default: '1',
                        primaryKey: false,
                        unique: true,
                        references: { table: 'teams', column: 'id', onDelete: 'CASCADE', onUpdate: 'CASCADE' },
                    },
                ],
                indexes: [],
            },
        ];

        const ops = diffSchema(dbSchema, models as Models);
        const addColumn = ops.find((op) => op.kind === 'column.add');
        expect(addColumn).toBeDefined();
        if (addColumn?.kind === 'column.add') {
            expect(isTrustedSqlFragment(addColumn.column.default)).toBe(true);
            if (isTrustedSqlFragment(addColumn.column.default)) {
                expect(addColumn.column.default.sql).toBe('1');
            }
            expect(addColumn.column.notNull).toBe(true);
            expect(addColumn.column.unique).toBe(true);
            expect(addColumn.column.references?.onDelete).toBe('CASCADE');
            expect(addColumn.column.references?.onUpdate).toBe('CASCADE');
        }
    });

    it('maps null and now defaults for table creation and added columns', () => {
        const dbSchema: DbSchema = {
            tables: {
                profiles: {
                    name: 'profiles',
                    columns: {
                        id: {
                            name: 'id',
                            type: 'integer',
                            notNull: true,
                            default: null,
                            isPk: true,
                            isUnique: false,
                        },
                    },
                    pks: ['id'],
                    indexes: {},
                    fks: {},
                },
            },
        };

        const createOps = diffSchema({ tables: {} }, [
            {
                name: 'Audit',
                table: 'audits',
                fields: [
                    { name: 'id', type: 'serial', primaryKey: true, notNull: true },
                    { name: 'created_at', type: 'timestamptz', default: { now: true } },
                    { name: 'archived_at', type: 'timestamptz', default: null },
                    { name: 'status', type: 'text', default: "'active'" },
                ],
            },
        ] as Models);
        expect(createOps[0]?.kind).toBe('table.create');

        const addOps = diffSchema(dbSchema, [
            {
                name: 'Profile',
                table: 'profiles',
                fields: [
                    { name: 'id', type: 'serial', primaryKey: true, notNull: true },
                    { name: 'created_at', type: 'timestamptz', default: { now: true }, primaryKey: false },
                    { name: 'archived_at', type: 'timestamptz', default: null, primaryKey: false },
                    { name: 'legacy_id', type: 'int', primaryKey: true },
                ],
            },
        ] as Models);

        const createdAt = addOps.find(
            (operation) => operation.kind === 'column.add' && operation.column.name === 'created_at'
        );
        const archivedAt = addOps.find(
            (operation) => operation.kind === 'column.add' && operation.column.name === 'archived_at'
        );
        const legacyId = addOps.find(
            (operation) => operation.kind === 'column.add' && operation.column.name === 'legacy_id'
        );

        expect(createdAt?.kind === 'column.add' && createdAt.column.default).toEqual({ now: true });
        expect(archivedAt?.kind === 'column.add' && archivedAt.column.default).toBeNull();
        expect(legacyId?.kind === 'column.add' && legacyId.column.primaryKey).toBe(true);
    });

    it('generates create index for missing index', () => {
        const dbSchema: DbSchema = {
            tables: {
                users: {
                    name: 'users',
                    columns: {
                        id: {
                            name: 'id',
                            type: 'integer',
                            notNull: true,
                            default: null,
                            isPk: true,
                            isUnique: false,
                        },
                        email: {
                            name: 'email',
                            type: 'text',
                            notNull: true,
                            default: null,
                            isPk: false,
                            isUnique: false,
                        },
                    },
                    pks: ['id'],
                    indexes: {},
                    fks: {},
                },
            },
        };

        const models = [
            {
                name: 'User',
                table: 'users',
                fields: [
                    {
                        name: 'id',
                        type: 'serial',
                        primaryKey: true,
                        notNull: true,
                        unique: false,
                        default: undefined,
                    },
                    {
                        name: 'email',
                        type: 'text',
                        primaryKey: false,
                        notNull: true,
                        unique: false,
                        default: undefined,
                    },
                ],
                indexes: [
                    {
                        name: 'users_email_idx',
                        on: ['email'],
                        unique: true,
                    },
                ],
            },
        ];

        const ops = diffSchema(dbSchema, models as Models);

        expect(
            ops.some((op) => op.kind === 'index.create' && op.name === 'users_email_idx' && op.unique === true)
        ).toBe(true);
    });

    it('generates drop column for removed field', () => {
        const dbSchema: DbSchema = {
            tables: {
                users: {
                    name: 'users',
                    columns: {
                        id: {
                            name: 'id',
                            type: 'integer',
                            notNull: true,
                            default: null,
                            isPk: true,
                            isUnique: false,
                        },
                        old_field: {
                            name: 'old_field',
                            type: 'text',
                            notNull: false,
                            default: null,
                            isPk: false,
                            isUnique: false,
                        },
                    },
                    pks: ['id'],
                    indexes: {},
                    fks: {},
                },
            },
        };

        const models = [
            {
                name: 'User',
                table: 'users',
                fields: [
                    {
                        name: 'id',
                        type: 'serial',
                        primaryKey: true,
                        notNull: true,
                        unique: false,
                        default: undefined,
                    },
                ],
                indexes: [],
            },
        ];

        const ops = diffSchema(dbSchema, models as Models);

        expect(ops.some((op) => op.kind === 'column.drop' && op.column === 'old_field')).toBe(true);
    });

    it('generates drop table for removed model', () => {
        const dbSchema: DbSchema = {
            tables: {
                old_table: {
                    name: 'old_table',
                    columns: {},
                    pks: [],
                    indexes: {},
                    fks: {},
                },
            },
        };

        const models: Parameters<typeof diffSchema>[1] = [];

        const ops = diffSchema(dbSchema, models as Models);

        expect(ops.some((op) => op.kind === 'table.drop' && op.table === 'old_table')).toBe(true);
    });

    it('handles no changes', () => {
        const dbSchema: DbSchema = {
            tables: {
                users: {
                    name: 'users',
                    columns: {
                        id: {
                            name: 'id',
                            type: 'integer',
                            notNull: true,
                            default: null,
                            isPk: true,
                            isUnique: false,
                        },
                    },
                    pks: ['id'],
                    indexes: {},
                    fks: {},
                },
            },
        };

        const models = [
            {
                name: 'User',
                table: 'users',
                fields: [
                    {
                        name: 'id',
                        type: 'serial',
                        primaryKey: true,
                        notNull: true,
                        unique: false,
                        default: undefined,
                    },
                ],
                indexes: [],
            },
        ];

        const ops = diffSchema(dbSchema, models as Models);

        expect(ops).toHaveLength(0);
    });

    it('drops stale indexes and ignores internal migration tables during model removals', () => {
        const dbSchema: DbSchema = {
            tables: {
                users: {
                    name: 'users',
                    columns: {
                        id: {
                            name: 'id',
                            type: 'integer',
                            notNull: true,
                            default: null,
                            isPk: true,
                            isUnique: false,
                        },
                    },
                    pks: ['id'],
                    indexes: {
                        users_legacy_idx: {
                            name: 'users_legacy_idx',
                            table: 'users',
                            unique: false,
                            columns: ['id'],
                            where: null,
                        },
                    },
                    fks: {},
                },
                _tango_migrations: {
                    name: '_tango_migrations',
                    columns: {},
                    pks: [],
                    indexes: {},
                    fks: {},
                },
            },
        };

        const models = [
            {
                name: 'User',
                table: 'users',
                fields: [{ name: 'id', type: 'serial', primaryKey: true, notNull: true }],
                indexes: [],
            },
        ];

        const ops = diffSchema(dbSchema, models as Models);
        expect(ops.some((operation) => operation.kind === 'index.drop' && operation.name === 'users_legacy_idx')).toBe(
            true
        );
        expect(
            ops.some((operation) => operation.kind === 'table.drop' && operation.table === '_tango_migrations')
        ).toBe(false);
    });

    it('does not emit index create/drop ops when indexes already match', () => {
        const dbSchema: DbSchema = {
            tables: {
                users: {
                    name: 'users',
                    columns: {
                        id: {
                            name: 'id',
                            type: 'integer',
                            notNull: true,
                            default: null,
                            isPk: true,
                            isUnique: false,
                        },
                    },
                    pks: ['id'],
                    indexes: {
                        users_id_idx: {
                            name: 'users_id_idx',
                            table: 'users',
                            unique: false,
                            columns: ['id'],
                            where: null,
                        },
                    },
                    fks: {},
                },
            },
        };

        const models = [
            {
                name: 'User',
                table: 'users',
                fields: [{ name: 'id', type: 'serial', primaryKey: true, notNull: true }],
                indexes: [{ name: 'users_id_idx', on: ['id'], unique: false }],
            },
        ];

        const ops = diffSchema(dbSchema, models as Models);
        expect(ops.some((operation) => operation.kind === 'index.create')).toBe(false);
        expect(ops.some((operation) => operation.kind === 'index.drop')).toBe(false);
    });
});
