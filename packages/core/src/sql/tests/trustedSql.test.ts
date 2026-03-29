import { describe, expect, it } from 'vitest';
import { trustedSql } from '../trustedSql';

describe(trustedSql, () => {
    it('brands a reviewed raw SQL fragment', () => {
        const fragment = trustedSql('deleted_at IS NULL');

        expect(fragment.sql).toBe('deleted_at IS NULL');
        expect(fragment.__tangoBrand).toBe('tango.core.trusted_sql_fragment');
    });
});
