import { TRUSTED_SQL_FRAGMENT_BRAND, type TrustedSqlFragment } from './TrustedSqlFragment';

/**
 * Narrow an unknown value to a trusted raw SQL fragment.
 */
export function isTrustedSqlFragment(value: unknown): value is TrustedSqlFragment {
    return (
        typeof value === 'object' &&
        value !== null &&
        (value as { __tangoBrand?: unknown }).__tangoBrand === TRUSTED_SQL_FRAGMENT_BRAND &&
        typeof (value as { sql?: unknown }).sql === 'string'
    );
}
