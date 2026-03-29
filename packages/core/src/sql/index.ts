/**
 * Domain boundary barrel: centralizes SQL safety primitives and policy helpers.
 */

export type { SqlDialect } from './SqlDialect';
export type { SqlIdentifierRole } from './SqlIdentifierRole';
export type { TrustedSqlFragment } from './TrustedSqlFragment';
export type { ValidatedSqlIdentifier } from './ValidatedSqlIdentifier';
export { SqlSafetyEngine } from './SqlSafetyEngine';
export type {
    SqlIdentifierRequest,
    SqlLookupTokenRequest,
    SqlRawFragmentRequest,
    SqlSafetyRequest,
    ValidatedSqlLookupToken,
    ValidatedSqlSafetyResult,
} from './SqlSafetyEngine';
export { trustedSql } from './trustedSql';
export { isTrustedSqlFragment } from './isTrustedSqlFragment';
export { validateSqlIdentifier } from './validateSqlIdentifier';
export { quoteSqlIdentifier } from './quoteSqlIdentifier';
