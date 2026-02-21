import { describe, expect, it } from 'vitest';
import { isTrustedSqlFragment } from '../isTrustedSqlFragment';
import { trustedSql } from '../trustedSql';

describe(isTrustedSqlFragment, () => {
    it('identifies trusted raw SQL fragments', () => {
        expect(isTrustedSqlFragment(trustedSql('now()'))).toBe(true);
        expect(isTrustedSqlFragment({ sql: 'now()' })).toBe(false);
    });
});
