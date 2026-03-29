import { describe, expect, it } from 'vitest';
import { SqlSafetyEngine } from '../SqlSafetyEngine';
import { trustedSql } from '../trustedSql';

describe(SqlSafetyEngine, () => {
    it('validates identifiers, lookup tokens, and trusted raw fragments', () => {
        const engine = new SqlSafetyEngine();
        const result = engine.validate({
            identifiers: [
                { key: 'table', role: 'table', value: 'users' },
                { key: 'column', role: 'column', value: 'email', allowlist: ['email', 'id'] },
            ],
            lookupTokens: [{ key: 'lookup', lookup: 'icontains', allowed: ['exact', 'icontains'] }],
            rawFragments: [{ key: 'where', value: trustedSql('deleted_at IS NULL') }],
        });

        expect(SqlSafetyEngine.isSqlSafetyEngine(engine)).toBe(true);
        expect(SqlSafetyEngine.isSqlSafetyEngine({})).toBe(false);
        expect(result.identifiers.table?.value).toBe('users');
        expect(result.identifiers.column?.value).toBe('email');
        expect(result.lookupTokens.lookup?.lookup).toBe('icontains');
        expect(result.rawFragments.where?.sql).toBe('deleted_at IS NULL');
    });

    it('rejects unknown lookups and untrusted raw fragments', () => {
        const engine = new SqlSafetyEngine();

        expect(() =>
            engine.validate({
                lookupTokens: [{ key: 'lookup', lookup: 'wat', allowed: ['exact'] }],
            })
        ).toThrow('Unknown lookup: wat');

        expect(() =>
            engine.validate({
                rawFragments: [{ key: 'where', value: { sql: 'deleted_at IS NULL' } as never }],
            })
        ).toThrow(/untrusted raw sql fragment/i);
    });

    it('returns empty validated maps when no safety inputs are provided', () => {
        const engine = new SqlSafetyEngine();

        expect(engine.validate({})).toEqual({
            identifiers: {},
            lookupTokens: {},
            rawFragments: {},
        });
    });
});
