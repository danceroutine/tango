import type { SqlDialect } from './SqlDialect';
import type { ValidatedSqlIdentifier } from './ValidatedSqlIdentifier';

/**
 * Quote a validated identifier for the target SQL dialect.
 */
export function quoteSqlIdentifier(identifier: ValidatedSqlIdentifier, _dialect: SqlDialect): string {
    return `"${identifier.value.replaceAll('"', '""')}"`;
}
