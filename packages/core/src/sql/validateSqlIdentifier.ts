import { VALIDATED_SQL_IDENTIFIER_BRAND, type ValidatedSqlIdentifier } from './ValidatedSqlIdentifier';
import { InternalSqlIdentifierRole, type SqlIdentifierRole } from './SqlIdentifierRole';

const SQL_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

const ROLE_LABELS: Record<SqlIdentifierRole, string> = {
    [InternalSqlIdentifierRole.TABLE]: 'table name',
    [InternalSqlIdentifierRole.COLUMN]: 'column',
    [InternalSqlIdentifierRole.PRIMARY_KEY]: 'primary key',
    [InternalSqlIdentifierRole.INDEX]: 'index',
    [InternalSqlIdentifierRole.ALIAS]: 'alias',
    [InternalSqlIdentifierRole.CONSTRAINT]: 'constraint',
    [InternalSqlIdentifierRole.SCHEMA]: 'schema',
    [InternalSqlIdentifierRole.RELATION_TABLE]: 'relation table',
    [InternalSqlIdentifierRole.RELATION_FOREIGN_KEY]: 'relation foreign key',
    [InternalSqlIdentifierRole.RELATION_TARGET_PRIMARY_KEY]: 'relation target primary key',
};

/**
 * Validate an identifier against Tango's SQL safety policy.
 */
export function validateSqlIdentifier(
    value: string,
    role: SqlIdentifierRole,
    allowlist?: readonly string[]
): ValidatedSqlIdentifier {
    const label = ROLE_LABELS[role];

    if (!SQL_IDENTIFIER_PATTERN.test(value)) {
        throw new Error(`Invalid SQL ${label}: '${value}'.`);
    }

    if (allowlist && !allowlist.includes(value)) {
        throw new Error(`Unknown SQL ${label}: '${value}'.`);
    }

    return {
        __tangoBrand: VALIDATED_SQL_IDENTIFIER_BRAND,
        role,
        value,
    };
}
