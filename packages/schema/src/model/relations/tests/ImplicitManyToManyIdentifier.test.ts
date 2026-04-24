import { describe, expect, it } from 'vitest';
import { ImplicitManyToManyIdentifier } from '../ImplicitManyToManyIdentifier';

describe(ImplicitManyToManyIdentifier, () => {
    describe(ImplicitManyToManyIdentifier.getModelKey, () => {
        it('returns a deterministic namespaced key for the same inputs', () => {
            const first = ImplicitManyToManyIdentifier.getModelKey('app.Post', 'tags', 'app.Tag');
            const second = ImplicitManyToManyIdentifier.getModelKey('app.Post', 'tags', 'app.Tag');
            expect(first).toBe(second);
            expect(first.startsWith(`${ImplicitManyToManyIdentifier.getNamespace()}/m2m_`)).toBe(true);
        });

        it('produces distinct keys when any input differs', () => {
            const base = ImplicitManyToManyIdentifier.getModelKey('app.Post', 'tags', 'app.Tag');
            expect(ImplicitManyToManyIdentifier.getModelKey('app.Article', 'tags', 'app.Tag')).not.toBe(base);
            expect(ImplicitManyToManyIdentifier.getModelKey('app.Post', 'labels', 'app.Tag')).not.toBe(base);
            expect(ImplicitManyToManyIdentifier.getModelKey('app.Post', 'tags', 'app.Label')).not.toBe(base);
        });
    });

    describe(ImplicitManyToManyIdentifier.getTableBaseDigest, () => {
        it('returns a shorter deterministic digest for join-table naming', () => {
            const digest = ImplicitManyToManyIdentifier.getTableBaseDigest('app.Post', 'tags', 'app.Tag');
            expect(digest).toHaveLength(16);
            expect(digest).toBe(ImplicitManyToManyIdentifier.getTableBaseDigest('app.Post', 'tags', 'app.Tag'));
        });
    });

    describe(ImplicitManyToManyIdentifier.isImplicitManyToManyModel, () => {
        it('returns true for keys produced by getModelKey', () => {
            const key = ImplicitManyToManyIdentifier.getModelKey('app.Post', 'tags', 'app.Tag');
            expect(ImplicitManyToManyIdentifier.isImplicitManyToManyModel(key)).toBe(true);
        });

        it('returns false for application model keys', () => {
            expect(ImplicitManyToManyIdentifier.isImplicitManyToManyModel('app.Post')).toBe(false);
        });
    });

    describe(ImplicitManyToManyIdentifier.getModelName, () => {
        it('strips the namespace prefix from a synthesized model key', () => {
            const key = ImplicitManyToManyIdentifier.getModelKey('app.Post', 'tags', 'app.Tag');
            expect(ImplicitManyToManyIdentifier.getModelName(key)).toMatch(/^m2m_[a-f0-9]{32}$/);
        });

        it('throws when given a key that was not produced by getModelKey', () => {
            expect(() => ImplicitManyToManyIdentifier.getModelName('app.Post')).toThrow(
                /expected a key produced by getModelKey/
            );
        });
    });
});
