import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ModelRegistry, ResolvedRelationGraphArtifactFactory, t } from '../../../index';
import { Model } from '../../Model';
import { ResolvedRelationGraphBuilder } from '../../relations/ResolvedRelationGraphBuilder';

describe(ResolvedRelationGraphArtifactFactory, () => {
    it('delegates to the builder-owned snapshot serializer', async () => {
        const registry = new ModelRegistry();

        const snapshots = await ModelRegistry.runWithRegistry(registry, async () => {
            const UserModel = Model({
                namespace: 'tests',
                name: 'User',
                schema: z.object({
                    id: t.primaryKey(z.number().int()),
                }),
            });
            Model({
                namespace: 'tests',
                name: 'Post',
                schema: z.object({
                    id: t.primaryKey(z.number().int()),
                    authorId: t.foreignKey(t.modelRef<typeof UserModel>('tests/User'), {
                        field: z.number().int(),
                        name: 'author',
                        relatedName: 'posts',
                    }),
                }),
            });

            const graph = registry.getResolvedRelationGraph();
            return {
                fromArtifactsClass: ResolvedRelationGraphArtifactFactory.createSnapshot(graph),
                fromBuilder: ResolvedRelationGraphBuilder.createSnapshot(graph),
            };
        });

        expect(snapshots.fromArtifactsClass).toEqual(snapshots.fromBuilder);
    });
});
