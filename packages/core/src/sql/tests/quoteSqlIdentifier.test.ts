import { describe, expect, it } from 'vitest';
import { quoteSqlIdentifier } from '../quoteSqlIdentifier';
import { validateSqlIdentifier } from '../validateSqlIdentifier';
import { InternalSqlDialect } from '../SqlDialect';

describe(quoteSqlIdentifier, () => {
    it('quotes validated identifiers for postgres and sqlite', () => {
        const identifier = validateSqlIdentifier('users', 'table');

        expect(quoteSqlIdentifier(identifier, InternalSqlDialect.POSTGRES)).toBe('"users"');
        expect(quoteSqlIdentifier(identifier, InternalSqlDialect.SQLITE)).toBe('"users"');
    });
});
