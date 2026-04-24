import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Model, ModelRegistry, t } from '@danceroutine/tango-schema';
import { buildMigrationModelMetadataProjection } from '../buildMigrationModelMetadataProjection';

describe(buildMigrationModelMetadataProjection, () => {
    beforeEach(() => {
        ModelRegistry.clear();
    });

    it('includes index metadata from registered models in the migration projection', () => {
        Model({
            namespace: 'blog',
            name: 'Tag',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });
        Model({
            namespace: 'blog',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                tags: t.manyToMany('blog/Tag'),
            }),
        });
        const projection = buildMigrationModelMetadataProjection(ModelRegistry.global());
        const joinProjection = projection.find((entry) => entry.table.startsWith('m2m_'));
        expect(joinProjection?.indexes?.some((index) => index.unique === true)).toBe(true);
    });

    it('does not mutate source primary keys into foreign keys when synthesizing implicit joins', () => {
        Model({
            namespace: 'blog',
            name: 'Tag',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                slug: t.unique(z.string()),
            }),
        });
        Model({
            namespace: 'blog',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                title: z.string(),
                tags: t.manyToMany('blog/Tag'),
            }),
        });

        const projection = buildMigrationModelMetadataProjection(ModelRegistry.global());
        const tagProjection = projection.find((entry) => entry.table === 'tags');
        const joinProjection = projection.find((entry) => entry.table.startsWith('m2m_'));
        const tagId = tagProjection?.fields.find((field) => field.name === 'id');
        const joinPostId = joinProjection?.fields.find((field) => field.name === 'postId');
        const joinTagId = joinProjection?.fields.find((field) => field.name === 'tagId');

        expect(tagId?.references).toBeUndefined();
        expect(joinPostId?.primaryKey).not.toBe(true);
        expect(joinTagId?.primaryKey).not.toBe(true);
        expect(joinPostId?.references?.table).toBe('posts');
        expect(joinTagId?.references?.table).toBe('tags');
        expect(joinPostId?.references?.onDelete).toBe('CASCADE');
        expect(joinPostId?.references?.onUpdate).toBe('CASCADE');
        expect(joinTagId?.references?.onDelete).toBe('CASCADE');
        expect(joinTagId?.references?.onUpdate).toBe('CASCADE');
    });
});
