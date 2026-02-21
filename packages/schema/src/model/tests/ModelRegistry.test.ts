import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Model, ModelRegistry, t } from '../index';

describe(ModelRegistry, () => {
    beforeEach(() => {
        ModelRegistry.clear();
    });

    it('stores and resolves models through the shared registry', () => {
        const user = Model({
            namespace: 'blog',
            name: 'User',
            table: 'users',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
        });

        ModelRegistry.clear();
        ModelRegistry.register(user);

        expect(ModelRegistry.get('blog', 'User')).toBe(user);
        expect(ModelRegistry.getByKey('blog/User')).toBe(user);
        expect(ModelRegistry.resolveRef('blog/User')).toBe(user);
        expect(ModelRegistry.resolveRef(user)).toBe(user);
        expect(ModelRegistry.resolveRef(() => user)).toBe(user);
    });

    it('stores and resolves models through isolated registries', () => {
        const registry = new ModelRegistry();

        const user = Model({
            namespace: 'blog',
            name: 'User',
            table: 'users',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
        });

        registry.clear();
        registry.register(user);
        expect(registry.getByKey('blog/User')).toBe(user);

        const post = Model({
            namespace: 'blog',
            name: 'Post',
            table: 'posts',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
        });

        registry.clear();
        registry.registerMany([user, post]);
        expect(registry.get('blog', 'Post')).toBe(post);
        expect(registry.resolveRef('blog/Post')).toBe(post);

        ModelRegistry.clear();
        ModelRegistry.registerMany([user, post]);
        expect(ModelRegistry.getByKey('blog/Post')).toBe(post);
    });

    it('throws for unresolved string references', () => {
        expect(() => ModelRegistry.resolveRef('blog/Unknown')).toThrow(
            "Unable to resolve model reference 'blog/Unknown'"
        );
    });
});
