import { describe, expect, it } from 'vitest';
import { validateSqlIdentifier } from '../validateSqlIdentifier';

describe(validateSqlIdentifier, () => {
    it('accepts valid identifiers', () => {
        expect(validateSqlIdentifier('users', 'table')).toEqual({
            __tangoBrand: 'tango.core.validated_sql_identifier',
            role: 'table',
            value: 'users',
        });
    });

    it('rejects malformed identifiers', () => {
        expect(() => validateSqlIdentifier('users; DROP TABLE users;', 'table')).toThrow(/invalid sql table name/i);
    });

    it('rejects allowlist misses', () => {
        expect(() => validateSqlIdentifier('email', 'column', ['id'])).toThrow(/unknown sql column/i);
    });
});
