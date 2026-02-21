import { TRUSTED_SQL_FRAGMENT_BRAND, type TrustedSqlFragment } from './TrustedSqlFragment';

/**
 * Explicitly opt into embedding a reviewed raw SQL fragment.
 */
export function trustedSql(sql: string): TrustedSqlFragment {
    return {
        __tangoBrand: TRUSTED_SQL_FRAGMENT_BRAND,
        sql,
    };
}
