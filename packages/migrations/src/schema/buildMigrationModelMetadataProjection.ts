import type { ModelRegistry } from '@danceroutine/tango-schema';
import type { Dialect } from '../domain/Dialect';
import type { ModelMetadataLike } from '../diff/diffSchema';
import { createModelFieldMapperStrategy } from './field/strategy/createModelFieldMapperStrategy';

export type BuildMigrationModelMetadataProjectionOptions = {
    dialect?: Dialect;
};

export function buildMigrationModelMetadataProjection(
    registry: ModelRegistry,
    options?: BuildMigrationModelMetadataProjectionOptions
): ModelMetadataLike[] {
    registry.finalizeStorageArtifacts();
    const fieldMapperStrategy = createModelFieldMapperStrategy(options?.dialect);
    const projection: ModelMetadataLike[] = [];
    for (const model of registry.values()) {
        const finalized = registry.getFinalizedFields(model.metadata.key);
        projection.push({
            name: model.metadata.name,
            table: model.metadata.table,
            managed: model.metadata.managed ?? true,
            fields: finalized.map((field) => fieldMapperStrategy.mapField(field)),
            indexes: model.metadata.indexes?.map((index) => ({
                name: index.name,
                on: [...index.on],
                unique: index.unique,
            })),
        });
    }
    return projection;
}
