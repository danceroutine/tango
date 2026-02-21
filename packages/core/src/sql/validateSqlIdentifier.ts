import { VALIDATED_SQL_IDENTIFIER_BRAND, type ValidatedSqlIdentifier } from './ValidatedSqlIdentifier';
import { INTERNAL_SQL_IDENTIFIER_ROLE, type SqlIdentifierRole } from './SqlIdentifierRole';

const SQL_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

const ROLE_LABELS: Record<SqlIdentifierRole, string> = {
    [INTERNAL_SQL_IDENTIFIER_ROLE.TABLE]: 'table name',
    [INTERNAL_SQL_IDENTIFIER_ROLE.COLUMN]: 'column',
    [INTERNAL_SQL_IDENTIFIER_ROLE.PRIMARY_KEY]: 'primary key',
    [INTERNAL_SQL_IDENTIFIER_ROLE.INDEX]: 'index',
    [INTERNAL_SQL_IDENTIFIER_ROLE.ALIAS]: 'alias',
    [INTERNAL_SQL_IDENTIFIER_ROLE.CONSTRAINT]: 'constraint',
    [INTERNAL_SQL_IDENTIFIER_ROLE.SCHEMA]: 'schema',
    [INTERNAL_SQL_IDENTIFIER_ROLE.RELATION_TABLE]: 'relation table',
    [INTERNAL_SQL_IDENTIFIER_ROLE.RELATION_FOREIGN_KEY]: 'relation foreign key',
    [INTERNAL_SQL_IDENTIFIER_ROLE.RELATION_TARGET_PRIMARY_KEY]: 'relation target primary key',
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
