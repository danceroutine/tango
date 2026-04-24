import { describe, expect, it } from 'vitest';
import { generateRelationRegistryArtifacts } from '../generateRelationRegistryArtifacts';

describe(generateRelationRegistryArtifacts, () => {
    it('emits an ambient registry declaration and metadata payload for hydratable relations', () => {
        const artifacts = generateRelationRegistryArtifacts({
            fingerprint: 'abc123',
            modelTypeAccessors: {
                'blog/User': 'typeof import("../src/models.ts")["UserModel"]',
                'blog/Post': 'typeof import("../src/models.ts")["PostModel"]',
            },
            snapshot: {
                models: [
                    {
                        key: 'blog/Post',
                        relations: [
                            {
                                edgeId: 'blog/Post:author',
                                sourceModelKey: 'blog/Post',
                                targetModelKey: 'blog/User',
                                name: 'author',
                                kind: 'belongsTo',
                                storageStrategy: 'reference',
                                cardinality: 'single',
                                localFieldName: 'author_id',
                                targetFieldName: 'id',
                                alias: 'user_author',
                                capabilities: {
                                    migratable: true,
                                    queryable: true,
                                    hydratable: true,
                                },
                            },
                        ],
                    },
                    {
                        key: 'blog/User',
                        relations: [
                            {
                                edgeId: 'blog/User:posts',
                                sourceModelKey: 'blog/User',
                                targetModelKey: 'blog/Post',
                                name: 'posts',
                                kind: 'hasMany',
                                storageStrategy: 'reverse_reference',
                                cardinality: 'many',
                                localFieldName: 'author_id',
                                targetFieldName: 'id',
                                alias: 'post_posts',
                                capabilities: {
                                    migratable: true,
                                    queryable: true,
                                    hydratable: true,
                                },
                            },
                        ],
                    },
                ],
            },
        });

        expect(artifacts.declaration).toContain('interface TangoGeneratedRelationRegistry');
        expect(artifacts.declaration).toContain('"blog/User": {');
        expect(artifacts.declaration).toContain(
            '"posts": { target: typeof import("../src/models.ts")["PostModel"]; cardinality: "many"; kind: "hasMany" };'
        );
        expect(artifacts.metadata).toEqual({
            version: 1,
            fingerprint: 'abc123',
            snapshot: expect.any(Object),
        });
    });

    it('rejects unresolved target model accessors', () => {
        expect(() =>
            generateRelationRegistryArtifacts({
                fingerprint: 'abc123',
                modelTypeAccessors: {},
                snapshot: {
                    models: [
                        {
                            key: 'blog/User',
                            relations: [
                                {
                                    edgeId: 'blog/User:posts',
                                    sourceModelKey: 'blog/User',
                                    targetModelKey: 'blog/Post',
                                    name: 'posts',
                                    kind: 'hasMany',
                                    storageStrategy: 'reverse_reference',
                                    cardinality: 'many',
                                    alias: 'post_posts',
                                    capabilities: {
                                        migratable: true,
                                        queryable: true,
                                        hydratable: true,
                                    },
                                },
                            ],
                        },
                    ],
                },
            })
        ).toThrow("Unable to generate relation typing for 'blog/Post'.");
    });

    it('skips non-hydratable relations when generating accessors and emits never maps when none remain', () => {
        const artifacts = generateRelationRegistryArtifacts({
            fingerprint: 'abc123',
            modelTypeAccessors: {},
            snapshot: {
                models: [
                    {
                        key: 'blog/User',
                        relations: [
                            {
                                edgeId: 'blog/User:posts',
                                sourceModelKey: 'blog/User',
                                targetModelKey: 'blog/Post',
                                name: 'posts',
                                kind: 'hasMany',
                                storageStrategy: 'reverse_reference',
                                cardinality: 'many',
                                alias: 'post_posts',
                                capabilities: {
                                    migratable: true,
                                    queryable: true,
                                    hydratable: false,
                                },
                            },
                        ],
                    },
                ],
            },
        });

        expect(artifacts.declaration).toContain('"blog/User": {');
        expect(artifacts.declaration).toContain('[key: string]: never;');
        expect(artifacts.declaration).not.toContain('"posts": {');
    });

    it('treats implicit many-to-many through models as internal and skips them in the generated registry', () => {
        const artifacts = generateRelationRegistryArtifacts({
            fingerprint: 'abc123',
            modelTypeAccessors: {
                'blog/Post': 'typeof import("../src/models.ts")["PostModel"]',
                'blog/Tag': 'typeof import("../src/models.ts")["TagModel"]',
            },
            snapshot: {
                models: [
                    {
                        key: 'blog/Post',
                        relations: [
                            {
                                edgeId: 'blog/Post:tags',
                                sourceModelKey: 'blog/Post',
                                targetModelKey: 'blog/Tag',
                                name: 'tags',
                                kind: 'manyToMany',
                                storageStrategy: 'many_to_many',
                                cardinality: 'many',
                                throughModelKey: 'tango.implicit/m2m_deadbeef',
                                throughTable: 'm2m_deadbeef',
                                throughSourceFieldName: 'postId',
                                throughTargetFieldName: 'tagId',
                                throughSourceKey: 'post_id',
                                throughTargetKey: 'tag_id',
                                alias: 'tag_tags',
                                capabilities: {
                                    migratable: false,
                                    queryable: true,
                                    hydratable: true,
                                },
                            },
                        ],
                    },
                    {
                        key: 'tango.implicit/m2m_deadbeef',
                        relations: [
                            {
                                edgeId: 'tango.implicit/m2m_deadbeef:post',
                                sourceModelKey: 'tango.implicit/m2m_deadbeef',
                                targetModelKey: 'blog/Post',
                                name: 'post',
                                kind: 'belongsTo',
                                storageStrategy: 'reference',
                                cardinality: 'single',
                                alias: 'post_post',
                                capabilities: {
                                    migratable: true,
                                    queryable: true,
                                    hydratable: true,
                                },
                            },
                        ],
                    },
                ],
            },
        });

        expect(artifacts.declaration).toContain('"blog/Post": {');
        expect(artifacts.declaration).toContain(
            '"tags": { target: typeof import("../src/models.ts")["TagModel"]; cardinality: "many"; kind: "manyToMany" };'
        );
        expect(artifacts.declaration).not.toContain('"tango.implicit/m2m_deadbeef": {');
        expect(artifacts.declaration).not.toContain('"post": { target: typeof import("../src/models.ts")["PostModel"]');
    });

    it('ignores implicit through reverse-reference targets when building the public registry', () => {
        const artifacts = generateRelationRegistryArtifacts({
            fingerprint: 'abc123',
            modelTypeAccessors: {
                'blog/Post': 'typeof import("../src/models.ts")["PostModel"]',
                'blog/Tag': 'typeof import("../src/models.ts")["TagModel"]',
            },
            snapshot: {
                models: [
                    {
                        key: 'blog/Post',
                        relations: [
                            {
                                edgeId: 'tango.implicit/m2m_deadbeef:postId:foreignKey:inverse',
                                sourceModelKey: 'blog/Post',
                                targetModelKey: 'tango.implicit/m2m_deadbeef',
                                name: 'm2m_deadbeefs',
                                inverseEdgeId: 'tango.implicit/m2m_deadbeef:postId:foreignKey',
                                kind: 'hasMany',
                                storageStrategy: 'reverse_reference',
                                cardinality: 'many',
                                localFieldName: 'postId',
                                targetFieldName: 'id',
                                alias: 'm2m_deadbeef_m2m_deadbeefs',
                                capabilities: {
                                    migratable: true,
                                    queryable: true,
                                    hydratable: true,
                                },
                            },
                            {
                                edgeId: 'blog/Post:tags',
                                sourceModelKey: 'blog/Post',
                                targetModelKey: 'blog/Tag',
                                name: 'tags',
                                kind: 'manyToMany',
                                storageStrategy: 'many_to_many',
                                cardinality: 'many',
                                throughModelKey: 'tango.implicit/m2m_deadbeef',
                                throughTable: 'm2m_deadbeef',
                                throughSourceFieldName: 'postId',
                                throughTargetFieldName: 'tagId',
                                throughSourceKey: 'post_id',
                                throughTargetKey: 'tag_id',
                                alias: 'tag_tags',
                                capabilities: {
                                    migratable: false,
                                    queryable: true,
                                    hydratable: true,
                                },
                            },
                        ],
                    },
                ],
            },
        });

        expect(artifacts.declaration).toContain('"tags": { target: typeof import("../src/models.ts")["TagModel"]');
        expect(artifacts.declaration).not.toContain('m2m_deadbeefs');
        expect(artifacts.declaration).not.toContain('tango.implicit/m2m_deadbeef');
    });
});
