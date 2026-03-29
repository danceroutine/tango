import type { MigrationOperation } from '../../domain/MigrationOperation';
import type { SQL } from '../contracts/SQL';
import type { ColumnSpec } from '../../builder/contracts/ColumnSpec';
import type { SQLCompiler } from '../contracts/SQLCompiler';
import { InternalOperationKind } from '../../domain/internal/InternalOperationKind';
import { InternalColumnType } from '../../domain/internal/InternalColumnType';
import { MigrationSqlSafetyAdapter } from '../../internal/MigrationSqlSafetyAdapter';

/**
 * SQLite SQL compiler for migration operations.
 */
export class SqliteCompiler implements SQLCompiler {
    static readonly BRAND = 'tango.migrations.sqlite_compiler' as const;
    readonly __tangoBrand: typeof SqliteCompiler.BRAND = SqliteCompiler.BRAND;
    private readonly sqlSafety = new MigrationSqlSafetyAdapter('sqlite');

    /**
     * Narrow an unknown value to the SQLite migration compiler implementation.
     */
    static isSqliteCompiler(value: unknown): value is SqliteCompiler {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === SqliteCompiler.BRAND
        );
    }

    /**
     * Compile a migration operation into one or more SQLite statements.
     */
    compile(op: MigrationOperation): SQL[] {
        switch (op.kind) {
            case InternalOperationKind.TABLE_CREATE: {
                const cols = op.columns.map((c) => this.colDDL(c));
                const pkCols = op.columns
                    .filter((c) => c.primaryKey && c.type !== InternalColumnType.SERIAL)
                    .map((c) => this.sqlSafety.column(c.name));

                if (pkCols.length) {
                    cols.push(`PRIMARY KEY (${pkCols.join(', ')})`);
                }

                op.columns
                    .filter((column) => column.references)
                    .forEach((column) => {
                        const references = column.references!;
                        cols.push(
                            `FOREIGN KEY (${this.sqlSafety.column(column.name)}) REFERENCES ${this.sqlSafety.table(references.table)}(${this.sqlSafety.column(references.column)})${references.onDelete ? ` ON DELETE ${references.onDelete}` : ''}${references.onUpdate ? ` ON UPDATE ${references.onUpdate}` : ''}`
                        );
                    });

                const sql = `CREATE TABLE ${this.sqlSafety.table(op.table)} (${cols.join(', ')})`;
                return [{ sql, params: [] }];
            }

            case InternalOperationKind.TABLE_DROP:
                return [{ sql: `DROP TABLE ${this.sqlSafety.table(op.table)}`, params: [] }];

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
                const where = this.sqlSafety.optionalRawFragment('where', op.where);
                return [
                    {
                        sql: `CREATE ${uniq}INDEX ${this.sqlSafety.index(op.name)} ON ${this.sqlSafety.table(op.table)} (${cols})${where ? ` WHERE ${where}` : ''}`,
                        params: [],
                    },
                ];
            }

            case InternalOperationKind.INDEX_DROP:
                return [{ sql: `DROP INDEX ${this.sqlSafety.index(op.name)}`, params: [] }];

            case InternalOperationKind.COLUMN_ALTER:
            case InternalOperationKind.FK_CREATE:
            case InternalOperationKind.FK_VALIDATE:
            case InternalOperationKind.FK_DROP:
                return [];

            default:
                return [];
        }
    }

    private colDDL(column: ColumnSpec): string {
        const parts: string[] = [this.sqlSafety.column(column.name)];

        switch (column.type) {
            case InternalColumnType.SERIAL:
                parts.push('INTEGER PRIMARY KEY AUTOINCREMENT');
                return parts.join(' ');
            case InternalColumnType.INT:
                parts.push('INTEGER');
                break;
            case InternalColumnType.BIGINT:
                parts.push('INTEGER');
                break;
            case InternalColumnType.TEXT:
                parts.push('TEXT');
                break;
            case InternalColumnType.BOOL:
                parts.push('INTEGER');
                break;
            case InternalColumnType.TIMESTAMPTZ:
                parts.push('TEXT');
                break;
            case InternalColumnType.JSONB:
                parts.push('TEXT');
                break;
            case InternalColumnType.UUID:
                parts.push('TEXT');
                break;
        }

        if (column.notNull) {
            parts.push('NOT NULL');
        }
        const defaultSql = this.sqlSafety.rawDefault(column.default, "(datetime('now'))");
        if (defaultSql) {
            parts.push(`DEFAULT ${defaultSql}`);
        }
        if (column.unique && !column.primaryKey) {
            parts.push('UNIQUE');
        }

        return parts.join(' ');
    }
}
