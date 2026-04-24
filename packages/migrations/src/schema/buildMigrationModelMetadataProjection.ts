import type { ModelRegistry } from '@danceroutine/tango-schema';
import type { Field } from '@danceroutine/tango-schema/domain';
import type { ColumnType } from '../builder/contracts/ColumnType';
import type { ModelMetadataLike } from '../diff/diffSchema';

function fieldToModelField(field: Field): ModelMetadataLike['fields'][number] {
    return {
        name: field.name,
        type: field.type as ColumnType,
        notNull: field.notNull,
        default: field.default,
        primaryKey: field.primaryKey,
        unique: field.unique,
        references: field.references as ModelMetadataLike['fields'][number]['references'],
    };
}

export function buildMigrationModelMetadataProjection(registry: ModelRegistry): ModelMetadataLike[] {
    registry.finalizeStorageArtifacts();
    const projection: ModelMetadataLike[] = [];
    for (const model of registry.values()) {
        const finalized = registry.getFinalizedFields(model.metadata.key);
        projection.push({
            name: model.metadata.name,
            table: model.metadata.table,
            managed: model.metadata.managed ?? true,
            fields: finalized.map(fieldToModelField),
            indexes: model.metadata.indexes?.map((index) => ({
                name: index.name,
                on: [...index.on],
                unique: index.unique,
            })),
        });
    }
    return projection;
}
