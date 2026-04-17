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
            '"posts": { target: typeof import("../src/models.ts")["PostModel"]; cardinality: "many" };'
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
});
