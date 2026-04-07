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
export function Model<
    const TNamespace extends string,
    const TName extends string,
    TSchema extends z.ZodObject<z.ZodRawShape>,
>(
    definition: ModelDefinition<TSchema> & { namespace: TNamespace; name: TName }
): SchemaModel<TSchema, `${TNamespace}/${TName}`> {
    const registry = definition.registry ?? ModelRegistry.active();
    const model = applyModelAugmentors(
        InternalSchemaModel.create(definition, registry) as SchemaModel<TSchema, `${TNamespace}/${TName}`>
    );

    registry.register(model);
    return model;
}
