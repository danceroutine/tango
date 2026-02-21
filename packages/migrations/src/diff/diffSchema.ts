import { trustedSql } from '@danceroutine/tango-core';
import type { DbSchema } from '../introspect/PostgresIntrospector';
import type { MigrationOperation } from '../domain/MigrationOperation';
import type { ColumnType } from '../builder/contracts/ColumnType';
import type { DeleteReferentialAction } from '../builder/contracts/DeleteReferentialAction';
import type { UpdateReferentialAction } from '../builder/contracts/UpdateReferentialAction';
import { op, applyFieldType } from '../builder/index';

type ModelField = {
    name: string;
    type: ColumnType;
    notNull?: boolean;
    default?: string | { now: true } | null;
    primaryKey?: boolean;
    unique?: boolean;
    references?: {
        table: string;
        column: string;
        onDelete?: DeleteReferentialAction;
        onUpdate?: UpdateReferentialAction;
    };
};

type ModelIndex = {
    name: string;
    on: string[];
    unique?: boolean;
};

export type ModelMetadataLike = {
    name?: string;
    table: string;
    fields: ModelField[];
    indexes?: ModelIndex[];
};

/**
 * Compare model metadata with an introspected database schema and return the
 * operations needed to bring the database into alignment.
 */
export function diffSchema(db: DbSchema, models: ModelMetadataLike[]): MigrationOperation[] {
    const ops: MigrationOperation[] = [];
    const modelTables = new Set(models.map((model) => model.table));
    const internalTables = new Set(['_tango_migrations']);

    models.forEach((model) => {
        const dbTable = db.tables[model.table];

        if (!dbTable) {
            ops.push(
                op.table(model.table).create((cols) => {
                    model.fields.forEach((field) => {
                        cols.add(field.name, (builder) => {
                            builder = applyFieldType(builder, field.type);

                            if (field.notNull) {
                                builder = builder.notNull();
                            }

                            if (field.default === null) {
                                builder = builder.default(null);
                            } else if (field.default && typeof field.default === 'object' && 'now' in field.default) {
                                builder = builder.defaultNow();
                            } else if (typeof field.default === 'string') {
                                builder = builder.default(trustedSql(field.default));
                            }

                            if (field.primaryKey) {
                                builder = builder.primaryKey();
                            }

                            if (field.unique) {
                                builder = builder.unique();
                            }

                            if (field.references) {
                                builder = builder.references(field.references.table, field.references.column, {
                                    onDelete: field.references.onDelete,
                                    onUpdate: field.references.onUpdate,
                                });
                            }

                            return builder;
                        });
                    });
                })
            );

            (model.indexes ?? []).forEach((index) => {
                ops.push(
                    op.index.create({
                        name: index.name,
                        table: model.table,
                        on: index.on,
                        unique: !!index.unique,
                    })
                );
            });
            return;
        }

        const modelFieldNames = new Set(model.fields.map((field) => field.name));
        const dbFieldNames = new Set(Object.keys(dbTable.columns));

        model.fields.forEach((field) => {
            if (!dbFieldNames.has(field.name)) {
                ops.push(
                    op.table(model.table).addColumn(field.name, (builder) => {
                        builder = applyFieldType(builder, field.type);

                        if (field.notNull) {
                            builder = builder.notNull();
                        }
                        if (field.default === null) {
                            builder = builder.default(null);
                        } else if (field.default && typeof field.default === 'object' && 'now' in field.default) {
                            builder = builder.defaultNow();
                        } else if (typeof field.default === 'string') {
                            builder = builder.default(trustedSql(field.default));
                        }
                        if (field.primaryKey) {
                            builder = builder.primaryKey();
                        }
                        if (field.unique) {
                            builder = builder.unique();
                        }
                        if (field.references) {
                            builder = builder.references(field.references.table, field.references.column, {
                                onDelete: field.references.onDelete,
                                onUpdate: field.references.onUpdate,
                            });
                        }

                        return builder;
                    })
                );
            }
        });

        dbFieldNames.forEach((dbColumnName) => {
            if (!modelFieldNames.has(dbColumnName)) {
                ops.push(op.table(model.table).dropColumn(dbColumnName));
            }
        });

        const modelIndexes = new Map((model.indexes ?? []).map((index) => [index.name, index] as const));
        const dbIndexNames = new Set(Object.keys(dbTable.indexes));

        modelIndexes.forEach((index, indexName) => {
            if (!dbIndexNames.has(indexName)) {
                ops.push(
                    op.index.create({
                        name: index.name,
                        table: model.table,
                        on: index.on,
                        unique: !!index.unique,
                    })
                );
            }
        });

        dbIndexNames.forEach((dbIndexName) => {
            if (!modelIndexes.has(dbIndexName)) {
                ops.push(
                    op.index.drop({
                        name: dbIndexName,
                        table: model.table,
                    })
                );
            }
        });
    });

    Object.keys(db.tables).forEach((dbTableName) => {
        if (internalTables.has(dbTableName)) {
            return;
        }
        if (!modelTables.has(dbTableName)) {
            ops.push(op.table(dbTableName).drop());
        }
    });

    return ops;
}
