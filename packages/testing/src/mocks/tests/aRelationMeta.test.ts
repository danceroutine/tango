import { describe, expect, it } from 'vitest';
import { aRelationMeta } from '../aRelationMeta';

describe(aRelationMeta, () => {
    it('builds single-valued relation metadata with default capabilities', () => {
        const meta = aRelationMeta({
            kind: 'belongsTo',
            table: 'users',
            sourceKey: 'author_id',
            targetKey: 'id',
            targetColumns: { id: 'int' },
            alias: 'author',
        });

        expect(meta.cardinality).toBe('single');
        expect(meta.capabilities).toEqual({
            queryable: true,
            hydratable: true,
            joinable: true,
            prefetchable: true,
        });
        expect(meta.targetMeta).toEqual({
            modelKey: 'author:target',
            table: 'users',
            pk: 'id',
            columns: { id: 'int' },
        });
    });

    it('builds collection metadata and respects explicit overrides', () => {
        const meta = aRelationMeta({
            kind: 'manyToMany',
            table: 'tags',
            sourceKey: 'id',
            targetKey: 'id',
            targetColumns: { id: 'int' },
            alias: 'tags',
            targetPrimaryKey: 'tag_id',
            capabilities: {
                hydratable: false,
                prefetchable: false,
            },
        });

        expect(meta.cardinality).toBe('many');
        expect(meta.targetPrimaryKey).toBe('tag_id');
        expect(meta.capabilities).toEqual({
            queryable: true,
            hydratable: false,
            joinable: false,
            prefetchable: false,
        });
    });
});
