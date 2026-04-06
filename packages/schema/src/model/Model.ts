import { z } from 'zod';
import type { Model as SchemaModel } from '../domain/Model';
import type { ModelDefinition } from './ModelDefinition';
import { applyModelAugmentors } from './ModelAugmentorRegistry';
import { InternalSchemaModel } from './internal/InternalSchemaModel';
import { ModelRegistry } from './registry/ModelRegistry';

/**
 * Creates a model definition with metadata and schema validation.
 * Automatically finalizes field types through the owning model registry.
 */
export function Model<TSchema extends z.ZodObject<z.ZodRawShape>>(
    definition: ModelDefinition<TSchema>
): SchemaModel<TSchema> {
    const registry = definition.registry ?? ModelRegistry.active();
    const model = applyModelAugmentors(InternalSchemaModel.create(definition, registry) as SchemaModel<TSchema>);

    registry.register(model);
    return model;
}
