export const TRUSTED_SQL_FRAGMENT_BRAND = 'tango.core.trusted_sql_fragment' as const;

export type TrustedSqlFragment = {
    readonly __tangoBrand: typeof TRUSTED_SQL_FRAGMENT_BRAND;
    readonly sql: string;
};
