import type { SqlIdentifierRole } from './SqlIdentifierRole';

export const VALIDATED_SQL_IDENTIFIER_BRAND = 'tango.core.validated_sql_identifier' as const;

export type ValidatedSqlIdentifier = {
    readonly __tangoBrand: typeof VALIDATED_SQL_IDENTIFIER_BRAND;
    readonly role: SqlIdentifierRole;
    readonly value: string;
};
