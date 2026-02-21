import { quoteSqlIdentifier, validateSqlIdentifier, type SqlDialect } from '@danceroutine/tango-core';
import { Dialect, type IntegrationHarness } from '../domain/index';

/**
 * Seed rows directly into a table for integration tests that need known fixtures.
 */
export async function seedTable<T extends Record<string, unknown>>(
    harness: IntegrationHarness,
    table: string,
    rows: T[]
): Promise<void> {
    if (rows.length === 0) {
        return;
    }

    const columns = Object.keys(rows[0] ?? {});
    if (columns.length === 0) {
        return;
    }

    const dialect = harness.dialect as SqlDialect;
    const safeTable = quoteSqlIdentifier(validateSqlIdentifier(table, 'table'), dialect);
    const safeColumns = columns.map((column) =>
        quoteSqlIdentifier(validateSqlIdentifier(column, 'column', columns), dialect)
    );

    for (const row of rows) {
        const values = columns.map((column) => {
            const value = row[column];
            if (harness.dialect === Dialect.Sqlite && typeof value === 'boolean') {
                return value ? 1 : 0;
            }
            return value;
        });
        const placeholders =
            harness.dialect === Dialect.Postgres
                ? columns.map((_, index) => `$${index + 1}`).join(', ')
                : columns.map(() => '?').join(', ');

        await harness.dbClient.query(
            `INSERT INTO ${safeTable} (${safeColumns.join(', ')}) VALUES (${placeholders})`,
            values as unknown[]
        );
    }
}
