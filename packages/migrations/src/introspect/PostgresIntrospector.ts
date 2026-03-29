import type { DBClient, DatabaseIntrospector } from './DatabaseIntrospector';

/** Introspected column metadata. */
export interface DbColumn {
    name: string;
    type: string;
    notNull: boolean;
    default: string | null;
    isPk: boolean;
    isUnique: boolean;
}

/** Introspected index metadata. */
export interface DbIndex {
    name: string;
    table: string;
    unique: boolean;
    columns: string[];
    where: string | null;
}

/** Introspected foreign key metadata. */
export interface DbForeignKey {
    name: string;
    table: string;
    columns: string[];
    refTable: string;
    refColumns: string[];
    onDelete: string | null;
    onUpdate: string | null;
    validated: boolean;
}

/** Introspected table metadata. */
export interface DbTable {
    name: string;
    columns: Record<string, DbColumn>;
    pks: string[];
    indexes: Record<string, DbIndex>;
    fks: Record<string, DbForeignKey>;
}

/** Introspected schema metadata. */
export interface DbSchema {
    tables: Record<string, DbTable>;
}

/**
 * PostgreSQL implementation of schema introspection.
 */
export class PostgresIntrospector implements DatabaseIntrospector {
    static readonly BRAND = 'tango.migrations.postgres_introspector' as const;
    readonly __tangoBrand: typeof PostgresIntrospector.BRAND = PostgresIntrospector.BRAND;

    /**
     * Narrow an unknown value to the PostgreSQL schema introspector.
     */
    static isPostgresIntrospector(value: unknown): value is PostgresIntrospector {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === PostgresIntrospector.BRAND
        );
    }

    /**
     * Read table and column metadata from PostgreSQL system catalogs.
     */
    async introspect(client: DBClient): Promise<DbSchema> {
        const schema: DbSchema = { tables: {} };

        const tablesRes = await client.query<{ tbl_oid: string; table: string }>(`
      SELECT c.oid AS tbl_oid, c.relname AS table
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog','information_schema')
    `);

        await Promise.all(
            tablesRes.rows.map(async (tableRow) => {
                const table = tableRow.table as string;

                const colsRes = await client.query<{
                    name: string;
                    type: string;
                    not_null: boolean;
                    default_expr: string | null;
                }>(`
          SELECT a.attname AS name,
                 pg_catalog.format_type(a.atttypid,a.atttypmod) AS type,
                 a.attnotnull AS not_null,
                 pg_get_expr(ad.adbin, ad.adrelid) AS default_expr
          FROM pg_attribute a
          LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
          WHERE a.attrelid = '${tableRow.tbl_oid}'::oid AND a.attnum > 0 AND NOT a.attisdropped
          ORDER BY a.attnum
        `);

                const pkRes = await client.query<{ col: string }>(`
          SELECT a.attname AS col
          FROM pg_index i
          JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
          WHERE i.indrelid = '${tableRow.tbl_oid}'::oid AND i.indisprimary
        `);
                const pks = pkRes.rows.map((pkRow) => pkRow.col as string);

                const idxRes = await client.query<{
                    name: string;
                    unique: boolean;
                    where_clause: string | null;
                    columns: string[];
                }>(`
          SELECT
              idx.relname AS name,
              i.indisunique AS unique,
              pg_get_expr(i.indpred, i.indrelid) AS where_clause,
              ARRAY(
                  SELECT a.attname
                  FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
                  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
                  ORDER BY k.ord
              ) AS columns
          FROM pg_index i
          JOIN pg_class idx ON idx.oid = i.indexrelid
          LEFT JOIN pg_constraint con ON con.conindid = i.indexrelid
          WHERE i.indrelid = '${tableRow.tbl_oid}'::oid
            AND NOT i.indisprimary
            AND con.oid IS NULL
        `);

                const indexes = idxRes.rows.reduce<Record<string, DbIndex>>((accumulator, indexRow) => {
                    const name = String(indexRow.name);
                    accumulator[name] = {
                        name,
                        table,
                        unique: !!indexRow.unique,
                        columns: Array.isArray(indexRow.columns) ? indexRow.columns.map(String) : [],
                        where: indexRow.where_clause ? String(indexRow.where_clause) : null,
                    };
                    return accumulator;
                }, {});

                const columns = colsRes.rows.reduce<Record<string, DbColumn>>((accumulator, columnRow) => {
                    const name = columnRow.name as string;
                    const isPk = pks.includes(name);
                    accumulator[name] = {
                        name,
                        type: String(columnRow.type),
                        notNull: !!columnRow.not_null,
                        default: columnRow.default_expr ? String(columnRow.default_expr) : null,
                        isPk,
                        isUnique: false,
                    };
                    return accumulator;
                }, {});

                schema.tables[table] = {
                    name: table,
                    columns,
                    pks,
                    indexes,
                    fks: {},
                };
            })
        );

        return schema;
    }
}
