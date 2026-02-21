import type { SqlDialect } from './SqlDialect';
import type { SqlIdentifierRole } from './SqlIdentifierRole';
import { isTrustedSqlFragment } from './isTrustedSqlFragment';
import type { TrustedSqlFragment } from './TrustedSqlFragment';
import { validateSqlIdentifier } from './validateSqlIdentifier';
import type { ValidatedSqlIdentifier } from './ValidatedSqlIdentifier';

export type SqlIdentifierRequest = {
    key: string;
    role: SqlIdentifierRole;
    value: string;
    allowlist?: readonly string[];
};

export type SqlLookupTokenRequest = {
    key: string;
    lookup: string;
    allowed: readonly string[];
};

export type SqlRawFragmentRequest = {
    key: string;
    value: TrustedSqlFragment;
};

export type SqlSafetyRequest = {
    dialect?: SqlDialect;
    identifiers?: readonly SqlIdentifierRequest[];
    lookupTokens?: readonly SqlLookupTokenRequest[];
    rawFragments?: readonly SqlRawFragmentRequest[];
};

export type ValidatedSqlLookupToken = {
    lookup: string;
};

export type ValidatedSqlSafetyResult = {
    identifiers: Record<string, ValidatedSqlIdentifier>;
    lookupTokens: Record<string, ValidatedSqlLookupToken>;
    rawFragments: Record<string, TrustedSqlFragment>;
};

/**
 * Canonical SQL safety policy engine shared across Tango packages.
 */
export class SqlSafetyEngine {
    static readonly BRAND = 'tango.core.sql_safety_engine' as const;
    readonly __tangoBrand: typeof SqlSafetyEngine.BRAND = SqlSafetyEngine.BRAND;

    /**
     * Narrow an unknown value to `SqlSafetyEngine`.
     */
    static isSqlSafetyEngine(value: unknown): value is SqlSafetyEngine {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === SqlSafetyEngine.BRAND
        );
    }

    /**
     * Validate a canonical SQL safety request and return trusted tokens.
     */
    validate(request: SqlSafetyRequest): ValidatedSqlSafetyResult {
        return {
            identifiers: Object.fromEntries(
                (request.identifiers ?? []).map((entry) => [
                    entry.key,
                    validateSqlIdentifier(entry.value, entry.role, entry.allowlist),
                ])
            ),
            lookupTokens: Object.fromEntries(
                (request.lookupTokens ?? []).map((entry) => [entry.key, this.validateLookupToken(entry)])
            ),
            rawFragments: Object.fromEntries(
                (request.rawFragments ?? []).map((entry) => [entry.key, this.validateRawFragment(entry)])
            ),
        };
    }

    private validateLookupToken(entry: SqlLookupTokenRequest): ValidatedSqlLookupToken {
        if (!entry.allowed.includes(entry.lookup)) {
            throw new Error(`Unknown lookup: ${entry.lookup}`);
        }

        return {
            lookup: entry.lookup,
        };
    }

    private validateRawFragment(entry: SqlRawFragmentRequest): TrustedSqlFragment {
        if (!isTrustedSqlFragment(entry.value)) {
            throw new Error(`Untrusted raw SQL fragment for '${entry.key}'.`);
        }

        return entry.value;
    }
}
