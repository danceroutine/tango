import type { ForeignKeyCreate, MigrationOperation, TableCreate } from '../../domain/MigrationOperation';
import type { SQL } from '../contracts/SQL';
import type { ColumnSpec } from '../../builder/contracts/ColumnSpec';
import type { ColumnType } from '../../builder/contracts/ColumnType';
import type { SQLCompiler } from '../contracts/SQLCompiler';
import { InternalOperationKind } from '../../domain/internal/InternalOperationKind';
import { InternalColumnType } from '../../domain/internal/InternalColumnType';
import { MigrationSqlSafetyAdapter } from '../../internal/MigrationSqlSafetyAdapter';

/**
 * PostgreSQL SQL compiler for migration operations.
 */
export class PostgresCompiler implements SQLCompiler {
    static readonly BRAND = 'tango.migrations.postgres_compiler' as const;
    readonly __tangoBrand: typeof PostgresCompiler.BRAND = PostgresCompiler.BRAND;
    private readonly sqlSafety = new MigrationSqlSafetyAdapter('postgres');

    /**
     * Narrow an unknown value to the PostgreSQL migration compiler implementation.
     */
    static isPostgresCompiler(value: unknown): value is PostgresCompiler {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === PostgresCompiler.BRAND
        );
    }

    /**
     * Rewrite migration operations into PostgreSQL's preferred execution
     * order, including separating inline foreign keys from table creation.
     */
    prepareOperations(operations: MigrationOperation[]): MigrationOperation[] {
        const tableCreates: TableCreate[] = [];
        const remainder: MigrationOperation[] = [];

        for (const operation of operations) {
            if (operation.kind === InternalOperationKind.TABLE_CREATE) {
                tableCreates.push(operation);
            } else {
                remainder.push(operation);
            }
        }

        const strippedCreates: TableCreate[] = [];
        const foreignKeys: ForeignKeyCreate[] = [];

        for (const operation of tableCreates) {
            const { create, fks } = this.stripTableCreateForeignKeys(operation);
            strippedCreates.push(create);
            foreignKeys.push(...fks);
        }

        return [
            ...strippedCreates.sort((left, right) => left.table.localeCompare(right.table)),
            ...foreignKeys,
            ...remainder,
        ];
    }

    /**
     * Compile a migration operation into one or more PostgreSQL statements.
     */
    compile(op: MigrationOperation): SQL[] {
        switch (op.kind) {
            case InternalOperationKind.TABLE_CREATE: {
                const cols = op.columns.map((c) => this.colDDL(c)).join(', ');
                const pkCols = op.columns.filter((c) => c.primaryKey).map((c) => this.sqlSafety.column(c.name));
                const constraints: string[] = [];

                if (pkCols.length) {
                    constraints.push(`PRIMARY KEY (${pkCols.join(', ')})`);
                }

                op.columns
                    .filter((column) => column.references)
                    .forEach((column) => {
                        const references = column.references!;
                        const fkName = `${op.table}_${column.name}_fkey`;
                        let fk = `CONSTRAINT ${this.sqlSafety.constraint(fkName)} FOREIGN KEY (${this.sqlSafety.column(column.name)}) REFERENCES ${this.sqlSafety.table(references.table)}(${this.sqlSafety.column(references.column)})`;
                        if (references.onDelete) {
                            fk += ` ON DELETE ${references.onDelete}`;
                        }
                        if (references.onUpdate) {
                            fk += ` ON UPDATE ${references.onUpdate}`;
                        }
                        constraints.push(fk);
                    });

                const allParts = [cols, ...constraints].join(', ');
                const sql = `CREATE TABLE ${this.sqlSafety.table(op.table)} (${allParts})`;
                return [{ sql, params: [] }];
            }

            case InternalOperationKind.TABLE_DROP:
                return [
                    { sql: `DROP TABLE ${this.sqlSafety.table(op.table)}${op.cascade ? ' CASCADE' : ''}`, params: [] },
                ];

            case InternalOperationKind.COLUMN_ADD:
                return [
                    {
                        sql: `ALTER TABLE ${this.sqlSafety.table(op.table)} ADD COLUMN ${this.colDDL(op.column)}`,
                        params: [],
                    },
                ];

            case InternalOperationKind.COLUMN_DROP:
                return [
                    {
                        sql: `ALTER TABLE ${this.sqlSafety.table(op.table)} DROP COLUMN ${this.sqlSafety.column(op.column)}`,
                        params: [],
                    },
                ];

            case InternalOperationKind.COLUMN_ALTER: {
                const out: SQL[] = [];
                if (op.to.type) {
                    out.push({
                        sql: `ALTER TABLE ${this.sqlSafety.table(op.table)} ALTER COLUMN ${this.sqlSafety.column(op.column)} TYPE ${this.typeToSQL(op.to.type)}`,
                        params: [],
                    });
                }
                if (op.to.notNull !== undefined) {
                    out.push({
                        sql: `ALTER TABLE ${this.sqlSafety.table(op.table)} ALTER COLUMN ${this.sqlSafety.column(op.column)} ${op.to.notNull ? 'SET NOT NULL' : 'DROP NOT NULL'}`,
                        params: [],
                    });
                }
                out.push(...this.compileDefaultChange(op.table, op.column, op.to.default));
                return out;
            }

            case InternalOperationKind.COLUMN_RENAME:
                return [
                    {
                        sql: `ALTER TABLE ${this.sqlSafety.table(op.table)} RENAME COLUMN ${this.sqlSafety.column(op.from)} TO ${this.sqlSafety.column(op.to)}`,
                        params: [],
                    },
                ];

            case InternalOperationKind.INDEX_CREATE: {
                const cols = this.sqlSafety.columns(op.on).join(', ');
                const uniq = op.unique ? 'UNIQUE ' : '';
                const conc = op.concurrently ? 'CONCURRENTLY ' : '';
                const where = this.sqlSafety.optionalRawFragment('where', op.where);
                return [
                    {
                        sql: `CREATE ${uniq}INDEX ${conc}${this.sqlSafety.index(op.name)} ON ${this.sqlSafety.table(op.table)} (${cols})${where ? ` WHERE ${where}` : ''}`,
                        params: [],
                    },
                ];
            }

            case InternalOperationKind.INDEX_DROP: {
                const conc = op.concurrently ? 'CONCURRENTLY ' : '';
                return [{ sql: `DROP INDEX ${conc}${this.sqlSafety.index(op.name)}`, params: [] }];
            }

            case InternalOperationKind.FK_CREATE: {
                const cols = this.sqlSafety.columns(op.columns).join(', ');
                const refs = this.sqlSafety.columns(op.refColumns).join(', ');
                const name = op.name ?? `${op.table}_${op.columns.join('_')}_fkey`;
                const notValid = op.notValid ? ' NOT VALID' : '';
                const onDel = op.onDelete ? ` ON DELETE ${op.onDelete}` : '';
                const onUpd = op.onUpdate ? ` ON UPDATE ${op.onUpdate}` : '';
                return [
                    {
                        sql: `ALTER TABLE ${this.sqlSafety.table(op.table)} ADD CONSTRAINT ${this.sqlSafety.constraint(name)} FOREIGN KEY (${cols}) REFERENCES ${this.sqlSafety.table(op.refTable)} (${refs})${onDel}${onUpd}${notValid}`,
                        params: [],
                    },
                ];
            }

            case InternalOperationKind.FK_VALIDATE:
                return [
                    {
                        sql: `ALTER TABLE ${this.sqlSafety.table(op.table)} VALIDATE CONSTRAINT ${this.sqlSafety.constraint(op.name)}`,
                        params: [],
                    },
                ];

            case InternalOperationKind.FK_DROP:
                return [
                    {
                        sql: `ALTER TABLE ${this.sqlSafety.table(op.table)} DROP CONSTRAINT ${this.sqlSafety.constraint(op.name)}`,
                        params: [],
                    },
                ];

            default:
                return [];
        }
    }

    /**
     * Compile a DEFAULT value change into ALTER TABLE statements.
     * Extracted to flatten the nested conditional logic.
     */
    private compileDefaultChange(table: string, column: string, defaultValue: unknown): SQL[] {
        if (defaultValue === undefined) {
            return [];
        }

        if (defaultValue === null) {
            return [
                {
                    sql: `ALTER TABLE ${this.sqlSafety.table(table)} ALTER COLUMN ${this.sqlSafety.column(column)} DROP DEFAULT`,
                    params: [],
                },
            ];
        }

        if (this.sqlSafety.isTrustedFragment(defaultValue)) {
            return [
                {
                    sql: `ALTER TABLE ${this.sqlSafety.table(table)} ALTER COLUMN ${this.sqlSafety.column(column)} SET DEFAULT ${this.sqlSafety.rawFragment('default', defaultValue)}`,
                    params: [],
                },
            ];
        }

        if (
            defaultValue &&
            typeof defaultValue === 'object' &&
            'now' in defaultValue &&
            (defaultValue as { now?: unknown }).now
        ) {
            return [
                {
                    sql: `ALTER TABLE ${this.sqlSafety.table(table)} ALTER COLUMN ${this.sqlSafety.column(column)} SET DEFAULT now()`,
                    params: [],
                },
            ];
        }

        return [];
    }

    private stripTableCreateForeignKeys(op: TableCreate): { create: TableCreate; fks: ForeignKeyCreate[] } {
        const fks: ForeignKeyCreate[] = [];
        const columns = op.columns.map((column) => {
            if (!column.references) {
                return column;
            }

            const references = column.references;
            fks.push({
                kind: InternalOperationKind.FK_CREATE,
                table: op.table,
                columns: [column.name],
                refTable: references.table,
                refColumns: [references.column],
                onDelete: references.onDelete,
                onUpdate: references.onUpdate,
            });

            const { references: _references, ...rest } = column;
            return { ...rest };
        });

        return { create: { ...op, columns }, fks };
    }

    private colDDL(column: ColumnSpec): string {
        const parts: string[] = [this.sqlSafety.column(column.name)];

        switch (column.type) {
            case InternalColumnType.SERIAL:
                parts.push('SERIAL');
                break;
            case InternalColumnType.INT:
                parts.push('INTEGER');
                break;
            case InternalColumnType.BIGINT:
                parts.push('BIGINT');
                break;
            case InternalColumnType.TEXT:
                parts.push('TEXT');
                break;
            case InternalColumnType.BOOL:
                parts.push('BOOLEAN');
                break;
            case InternalColumnType.TIMESTAMPTZ:
                parts.push('TIMESTAMPTZ');
                break;
            case InternalColumnType.JSONB:
                parts.push('JSONB');
                break;
            case InternalColumnType.UUID:
                parts.push('UUID');
                break;
        }

        if (column.notNull) {
            parts.push('NOT NULL');
        }
        const defaultSql = this.sqlSafety.rawDefault(column.default, 'now()');
        if (defaultSql) {
            parts.push(`DEFAULT ${defaultSql}`);
        }
        if (column.unique && !column.primaryKey) {
            parts.push('UNIQUE');
        }

        return parts.join(' ');
    }

    private typeToSQL(type: ColumnType): string {
        switch (type) {
            case InternalColumnType.SERIAL:
                return 'SERIAL';
            case InternalColumnType.INT:
                return 'INTEGER';
            case InternalColumnType.BIGINT:
                return 'BIGINT';
            case InternalColumnType.TEXT:
                return 'TEXT';
            case InternalColumnType.BOOL:
                return 'BOOLEAN';
            case InternalColumnType.TIMESTAMPTZ:
                return 'TIMESTAMPTZ';
            case InternalColumnType.JSONB:
                return 'JSONB';
            case InternalColumnType.UUID:
                return 'UUID';
            default: {
                const exhaustive: never = type;
                throw new Error(`Unsupported column type: ${exhaustive}`);
            }
        }
    }
}
