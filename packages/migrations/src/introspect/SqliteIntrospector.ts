import type { DBClient, DatabaseIntrospector } from './DatabaseIntrospector';
import { MigrationSqlSafetyAdapter } from '../internal/MigrationSqlSafetyAdapter';

/** Introspected column metadata. */
export interface DbColumn {
    name: string;
    type: string;
    notNull: boolean;
    default: string | null;
    isPk: boolean;
    isUnique: boolean;
}

/** Introspected table metadata. */
export interface DbTable {
    name: string;
    columns: Record<string, DbColumn>;
    pks: string[];
    indexes: Record<string, { name: string; table: string; unique: boolean; columns: string[]; where: string | null }>;
    fks: Record<
        string,
        {
            name: string;
            table: string;
            columns: string[];
            refTable: string;
            refColumns: string[];
            onDelete: string | null;
            onUpdate: string | null;
            validated: boolean;
        }
    >;
}

/** Introspected schema metadata. */
export interface DbSchema {
    tables: Record<string, DbTable>;
}

/**
 * SQLite implementation of schema introspection.
 */
export class SqliteIntrospector implements DatabaseIntrospector {
    static readonly BRAND = 'tango.migrations.sqlite_introspector' as const;
    readonly __tangoBrand: typeof SqliteIntrospector.BRAND = SqliteIntrospector.BRAND;
    private readonly sqlSafety = new MigrationSqlSafetyAdapter('sqlite');

    /**
     * Narrow an unknown value to the SQLite schema introspector.
     */
    static isSqliteIntrospector(value: unknown): value is SqliteIntrospector {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === SqliteIntrospector.BRAND
        );
    }

    /**
     * Read table/column/index metadata from SQLite pragmas.
     */
    async introspect(client: DBClient): Promise<DbSchema> {
        const schema: DbSchema = { tables: {} };

        const tablesRes = await client.query<{ name: string }>(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);

        for (const tableRow of tablesRes.rows) {
            const table = tableRow.name as string;
            const safeTable = this.sqlSafety.table(table);

            const colsRes = await client.query<{
                name: string;
                pk: number;
                type: string;
                notnull: number;
                dflt_value: string | null;
            }>(`PRAGMA table_info(${safeTable})`);

            const columns: Record<string, DbColumn> = {};
            const pks: string[] = [];
            const indexes: Record<
                string,
                { name: string; table: string; unique: boolean; columns: string[]; where: string | null }
            > = {};

            for (const columnRow of colsRes.rows) {
                const name = columnRow.name as string;
                const isPk = columnRow.pk === 1;
                if (isPk) {
                    pks.push(name);
                }

                columns[name] = {
                    name,
                    type: String(columnRow.type),
                    notNull: columnRow.notnull === 1,
                    default: columnRow.dflt_value || null,
                    isPk,
                    isUnique: false,
                };
            }

            const indexListRes = await client.query<{ name: string; unique: number }>(
                `PRAGMA index_list(${safeTable})`
            );
            for (const indexRow of indexListRes.rows) {
                const name = String(indexRow.name);
                if (name.startsWith('sqlite_autoindex_')) {
                    continue;
                }

                const indexInfoRes = await client.query<{ name: string }>(
                    `PRAGMA index_info(${this.sqlSafety.index(name)})`
                );
                const on = indexInfoRes.rows.map((infoRow) => String(infoRow.name)).filter(Boolean);
                indexes[name] = {
                    name,
                    table,
                    columns: on,
                    unique: indexRow.unique === 1,
                    where: null,
                };
            }

            schema.tables[table] = {
                name: table,
                columns,
                pks,
                indexes,
                fks: {},
            };
        }

        return schema;
    }
}
