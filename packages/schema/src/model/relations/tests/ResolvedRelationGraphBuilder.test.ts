import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Model, ModelRegistry, t } from '../../index';
import { ImplicitManyToManyIdentifier } from '../ImplicitManyToManyIdentifier';
import { ResolvedRelationGraphBuilder } from '../ResolvedRelationGraphBuilder';

describe(ResolvedRelationGraphBuilder, () => {
    beforeEach(() => {
        ModelRegistry.clear();
    });

    it('rejects many-to-many edges when through field names do not exist on the through model', () => {
        const TagModel = Model({
            namespace: 'blog',
            name: 'Tag',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });
        const PostTagModel = Model({
            namespace: 'blog',
            name: 'PostTag',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                postId: t.foreignKey('blog/Post', { field: z.number().int() }),
                tagId: t.foreignKey(TagModel, { field: z.number().int() }),
            }),
        });
        Model({
            namespace: 'blog',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                tags: t.manyToMany(TagModel, {
                    name: 'tags',
                    through: PostTagModel,
                    throughSourceFieldName: 'missingPostLink',
                    throughTargetFieldName: 'tagId',
                }),
            }),
        });
        const registry = ModelRegistry.global();
        const storage = registry.finalizeStorageArtifacts();
        expect(() =>
            ResolvedRelationGraphBuilder.build({
                version: storage.version,
                models: registry.values(),
                storage,
                resolveRef: (ref) => registry.resolveRef(ref),
            })
        ).toThrow(/cannot find through fields/);
    });

    it('rejects many-to-many edges when through storage artifacts are absent', () => {
        const registry = new ModelRegistry();
        const TagModel = Model({
            registry,
            namespace: 'blog',
            name: 'Tag',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });
        const PostModel = Model({
            registry,
            namespace: 'blog',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                tags: t.manyToMany(TagModel),
            }),
        });
        const storage = registry.finalizeStorageArtifacts();
        const corrupted = { ...storage, byModel: new Map(storage.byModel) };
        corrupted.byModel.delete(
            ImplicitManyToManyIdentifier.getModelKey(PostModel.metadata.key, 'tags', TagModel.metadata.key)
        );
        expect(
            () =>
                ResolvedRelationGraphBuilder.build({
                    version: corrupted.version,
                    models: registry.values(),
                    storage: corrupted,
                    resolveRef: (ref) => registry.resolveRef(ref),
                })
            // TODO revisit our throw strategy to improve devex
        ).toThrow(/cannot resolve storage artifacts/);
    });

    it('does not publish reverse has-many edges from implicit through models onto public endpoints', () => {
        const registry = new ModelRegistry();
        const TagModel = Model({
            registry,
            namespace: 'blog',
            name: 'Tag',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });
        const PostModel = Model({
            registry,
            namespace: 'blog',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                tags: t.manyToMany(TagModel, { name: 'tags' }),
            }),
        });

        const snapshot = registry.getResolvedRelationGraphSnapshot();
        const postRelations = snapshot.models.find((model) => model.key === PostModel.metadata.key)?.relations ?? [];
        const tagRelations = snapshot.models.find((model) => model.key === TagModel.metadata.key)?.relations ?? [];

        expect(postRelations.map((relation) => relation.name)).toEqual(['tags']);
        expect(tagRelations).toEqual([]);
        expect(
            snapshot.models.some((model) =>
                model.relations.some((relation) => relation.targetModelKey.startsWith('tango.implicit/'))
            )
        ).toBe(false);
    });
});
