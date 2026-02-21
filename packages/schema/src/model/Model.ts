import { z } from 'zod';
import type { Model as SchemaModel } from '../domain/Model';
import type { ModelMetadata } from '../domain/index';
import type { ModelDefinition } from './ModelDefinition';
import { applyModelAugmentors } from './ModelAugmentorRegistry';
import { RelationBuilder } from './RelationBuilder';
import { inferFieldsFromSchema } from './inferFields';
import { ModelRegistry } from './registry/ModelRegistry';

function deriveTableName(name: string): string {
    const snake = toSnakeCase(name);
    return pluralize(snake);
}

function toSnakeCase(value: string): string {
    return value
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toLowerCase();
}

function pluralize(value: string): string {
    if (/(s|x|z|ch|sh)$/.test(value)) {
        return `${value}es`;
    }

    if (/[^aeiou]y$/.test(value)) {
        return `${value.slice(0, -1)}ies`;
    }

    return `${value}s`;
}

/**
 * Creates a model definition with metadata and schema validation.
 * Automatically infers field types from Zod schema if fields are not explicitly provided.
 */
export function Model<TSchema extends z.ZodObject<z.ZodRawShape>>(
    definition: ModelDefinition<TSchema>
): SchemaModel<TSchema> {
    if (!definition.namespace.trim()) {
        throw new Error('Model.namespace is required and cannot be empty.');
    }
    if (!definition.name.trim()) {
        throw new Error('Model.name is required and cannot be empty.');
    }
    if (definition.table !== undefined && !definition.table.trim()) {
        throw new Error('Model.table cannot be empty when provided.');
    }

    const builder = new RelationBuilder();
    const relations = definition.relations ? definition.relations(builder) : undefined;

    const registry = ModelRegistry.global();
    const fields = definition.fields || inferFieldsFromSchema(definition.schema, { registry });
    const key = `${definition.namespace}/${definition.name}`;
    const table = definition.table?.trim() || deriveTableName(definition.name);

    const metadata: ModelMetadata = {
        namespace: definition.namespace,
        name: definition.name,
        key,
        table,
        fields,
        indexes: definition.indexes,
        relations,
        ordering: definition.ordering,
        managed: definition.managed,
        defaultRelatedName: definition.defaultRelatedName,
        constraints: definition.constraints,
    };

    const baseModel = {
        metadata,
        schema: definition.schema,
        hooks: definition.hooks,
    } satisfies Pick<SchemaModel<TSchema>, 'metadata' | 'schema' | 'hooks'>;

    const model = applyModelAugmentors(baseModel as SchemaModel<TSchema>);

    registry.register(model);
    return model;
}
