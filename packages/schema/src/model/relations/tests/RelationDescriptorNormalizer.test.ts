import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { t } from '../../index';
import { RelationDescriptorNormalizer } from '../RelationDescriptorNormalizer';

describe(RelationDescriptorNormalizer, () => {
    it('collects normalized descriptors for decorated relation fields and derives naming hints', () => {
        const descriptors = RelationDescriptorNormalizer.normalize(
            'blog/Post',
            z.object({
                authorId: t.foreignKey('blog/User', { field: z.number().int() }),
                profile_id: t.oneToOne('blog/Profile', { field: z.number().int() }),
                tags: t.manyToMany('blog/Tag'),
            })
        );

        expect(descriptors).toEqual([
            {
                edgeId: 'blog/Post:authorId:foreignKey',
                sourceModelKey: 'blog/Post',
                sourceSchemaFieldKey: 'authorId',
                targetRef: 'blog/User',
                origin: 'foreignKey',
                localFieldName: 'authorId',
                dbColumnName: 'authorId',
                referencedTargetColumn: undefined,
                onDelete: undefined,
                onUpdate: undefined,
                unique: false,
                explicitForwardName: undefined,
                explicitReverseName: undefined,
                namingHint: 'author',
                provenance: 'field-decorator',
            },
            {
                edgeId: 'blog/Post:profile_id:oneToOne',
                sourceModelKey: 'blog/Post',
                sourceSchemaFieldKey: 'profile_id',
                targetRef: 'blog/Profile',
                origin: 'oneToOne',
                localFieldName: 'profile_id',
                dbColumnName: 'profile_id',
                referencedTargetColumn: undefined,
                onDelete: undefined,
                onUpdate: undefined,
                unique: true,
                explicitForwardName: undefined,
                explicitReverseName: undefined,
                namingHint: 'profile',
                provenance: 'field-decorator',
            },
            {
                edgeId: 'blog/Post:tags:manyToMany',
                sourceModelKey: 'blog/Post',
                sourceSchemaFieldKey: 'tags',
                targetRef: 'blog/Tag',
                origin: 'manyToMany',
                localFieldName: 'tags',
                dbColumnName: 'tags',
                referencedTargetColumn: undefined,
                onDelete: undefined,
                onUpdate: undefined,
                unique: false,
                explicitForwardName: undefined,
                explicitReverseName: undefined,
                namingHint: 'tags',
                provenance: 'field-decorator',
            },
        ]);
    });

    it('carries explicit decorator relation names into normalized descriptors', () => {
        const [descriptor] = RelationDescriptorNormalizer.normalize(
            'blog/Post',
            z.object({
                authorId: t.foreignKey('blog/User', {
                    field: z.number().int(),
                    name: 'writer',
                    relatedName: 'articles',
                }),
            })
        );

        expect(descriptor).toMatchObject({
            explicitForwardName: 'writer',
            explicitReverseName: 'articles',
            namingHint: 'author',
        });
    });

    it('ignores non-relation fields', () => {
        const descriptors = RelationDescriptorNormalizer.normalize(
            'blog/User',
            z.object({
                id: t.primaryKey(z.number().int()),
                email: z.string().email(),
            })
        );

        expect(descriptors).toEqual([]);
    });
});
