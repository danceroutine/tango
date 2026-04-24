import type { ColumnAdd, IndexCreate, MigrationOperation, TableCreate } from '../../domain/MigrationOperation';
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
     * Rewrite migration operations into SQLite's safe execution order,
     * including topological table creation and unique-column add expansion.
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

        const preparedRemainder = remainder.flatMap((operation) =>
            operation.kind === InternalOperationKind.COLUMN_ADD ? this.prepareColumnAdd(operation) : [operation]
        );

        return [...this.topologicalSortTableCreatesWithReferences(tableCreates), ...preparedRemainder];
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
                        sql: `ALTER TABLE ${this.sqlSafety.table(op.table)} ADD COLUMN ${this.colDDL({
                            ...op.column,
                            unique: false,
                        })}`,
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

    private prepareColumnAdd(op: ColumnAdd): MigrationOperation[] {
        const preparedColumn = op.column;
        if (preparedColumn.notNull && preparedColumn.default === undefined && !preparedColumn.primaryKey) {
            throw new Error(
                `SQLite cannot add NOT NULL column '${preparedColumn.name}' to '${op.table}' without a default or backfill path.`
            );
        }

        if (!preparedColumn.unique) {
            return [op];
        }

        const addColumn: ColumnAdd = {
            ...op,
            column: {
                ...preparedColumn,
                unique: false,
            },
        };
        const createIndex: IndexCreate = {
            kind: InternalOperationKind.INDEX_CREATE,
            name: `${op.table}_${preparedColumn.name}_idx`,
            table: op.table,
            on: [preparedColumn.name],
            unique: true,
        };

        return [addColumn, createIndex];
    }

    private topologicalSortTableCreatesWithReferences(creates: TableCreate[]): TableCreate[] {
        if (creates.length <= 1) {
            return creates;
        }

        const tableSet = new Set(creates.map((create) => create.table));
        const byTable = new Map(creates.map((create) => [create.table, create]));
        const incoming = new Map<string, number>();
        const dependents = new Map<string, Set<string>>();

        for (const table of tableSet) {
            incoming.set(table, 0);
        }

        for (const create of creates) {
            const seenParents = new Set<string>();
            for (const column of create.columns) {
                if (!column.references) {
                    continue;
                }
                const refTable = column.references.table;
                if (refTable === create.table || !tableSet.has(refTable)) {
                    continue;
                }
                if (seenParents.has(refTable)) {
                    continue;
                }
                seenParents.add(refTable);
                incoming.set(create.table, incoming.get(create.table)! + 1);
                if (!dependents.has(refTable)) {
                    dependents.set(refTable, new Set());
                }
                dependents.get(refTable)!.add(create.table);
            }
        }

        const ready = [...tableSet].filter((table) => incoming.get(table) === 0);
        ready.sort((left, right) => left.localeCompare(right));

        const sorted: TableCreate[] = [];
        while (ready.length) {
            const next = ready.shift()!;
            sorted.push(byTable.get(next)!);

            for (const dependent of dependents.get(next) ?? []) {
                incoming.set(dependent, incoming.get(dependent)! - 1);
                if (incoming.get(dependent) === 0) {
                    ready.push(dependent);
                    ready.sort((left, right) => left.localeCompare(right));
                }
            }
        }

        if (sorted.length !== creates.length) {
            return [...creates].sort((left, right) => left.table.localeCompare(right.table));
        }

        return sorted;
    }
}
