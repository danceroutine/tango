import { describe, expect, it } from 'vitest';
import { quoteSqlIdentifier } from '../quoteSqlIdentifier';
import { validateSqlIdentifier } from '../validateSqlIdentifier';
import { INTERNAL_SQL_DIALECT } from '../SqlDialect';

describe(quoteSqlIdentifier, () => {
    it('quotes validated identifiers for postgres and sqlite', () => {
        const identifier = validateSqlIdentifier('users', 'table');

        expect(quoteSqlIdentifier(identifier, INTERNAL_SQL_DIALECT.POSTGRES)).toBe('"users"');
        expect(quoteSqlIdentifier(identifier, INTERNAL_SQL_DIALECT.SQLITE)).toBe('"users"');
    });
});
