import { describe, expect, it } from 'vitest';
import { c, i, m } from '../index';

describe('meta and constraint builders', () => {
    it('builds model meta fragments and merges them', () => {
        const merged = m.merge(
            m.ordering('createdAt', '-id'),
            m.managed(true),
            m.defaultRelatedName('comments'),
            m.indexes({ name: 'idx_posts_author', on: ['authorId'] }),
            m.constraints({ kind: 'custom', value: 1 }),
            m.uniqueTogether(['email', 'username']),
            m.indexTogether(['createdAt'])
        );

        expect(merged.ordering).toEqual(['createdAt', '-id']);
        expect(merged.managed).toBe(true);
        expect(merged.defaultRelatedName).toBe('comments');
        expect(merged.indexes?.length).toBe(2);
        expect(merged.constraints?.length).toBe(2);
    });

    it('builds constraints and index definitions', () => {
        expect(c.unique(['email'], { name: 'users_email_key', where: 'email IS NOT NULL' })).toEqual({
            kind: 'unique',
            fields: ['email'],
            name: 'users_email_key',
            where: 'email IS NOT NULL',
        });
        expect(c.unique(['username'])).toEqual({
            kind: 'unique',
            fields: ['username'],
        });

        expect(c.check('age > 0', { name: 'users_age_positive' })).toEqual({
            kind: 'check',
            condition: 'age > 0',
            name: 'users_age_positive',
        });
        expect(c.check('age > 1')).toEqual({
            kind: 'check',
            condition: 'age > 1',
        });

        expect(c.exclusion({ using: 'gist', elements: ['room', 'during'], where: 'cancelled = false' })).toEqual({
            kind: 'exclusion',
            using: 'gist',
            elements: ['room', 'during'],
            where: 'cancelled = false',
        });

        expect(i.index(['authorId'])).toEqual({
            name: 'idx_authorId',
            on: ['authorId'],
            unique: undefined,
            where: undefined,
        });

        expect(i.index(['slug'], { name: 'posts_slug_idx', unique: true, where: 'published = true' })).toEqual({
            name: 'posts_slug_idx',
            on: ['slug'],
            unique: true,
            where: 'published = true',
        });
    });
});
