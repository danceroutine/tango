import { z } from 'zod';
import type {
    Field,
    Model,
    ModelAugmentations,
    ModelMetadata,
    ModelWriteHooks,
    PersistedModelOutput,
    RelationDef,
} from '../../domain/index';
import type { ModelDefinition } from '../ModelDefinition';
import { RelationBuilder } from '../relations/RelationBuilder';
import type { ModelRegistry } from '../registry/ModelRegistry';
import type { NormalizedRelationStorageDescriptor } from '../relations/NormalizedRelationStorageDescriptor';
import { RelationDescriptorNormalizer } from '../relations/RelationDescriptorNormalizer';
import { deriveTableName } from '../relations/SchemaNaming';

type AnySchemaModel = Model<z.ZodObject<z.ZodRawShape>>;
type AnyInternalSchemaModel = InternalSchemaModel<z.ZodObject<z.ZodRawShape>>;

export class InternalSchemaModel<TSchema extends z.ZodObject<z.ZodRawShape>, TKey extends string = string>
    implements Model<TSchema, TKey>
{
    static readonly BRAND = 'tango.schema.internal_schema_model' as const;

    readonly __tangoBrand: typeof InternalSchemaModel.BRAND = InternalSchemaModel.BRAND;
    readonly metadata: ModelMetadata;
    readonly schema: TSchema;
    readonly hooks?: ModelWriteHooks<PersistedModelOutput<TSchema>>;
    declare readonly objects: ModelAugmentations<TSchema, TKey> extends { readonly objects: infer TObject }
        ? TObject
        : never;

    private readonly registry: ModelRegistry;
    private readonly normalizedRelations: readonly NormalizedRelationStorageDescriptor[];
    private readonly explicitFields?: readonly Field[];
    private readonly explicitRelations?: Readonly<Record<string, RelationDef>>;

    private constructor(
        registry: ModelRegistry,
        metadata: ModelMetadata,
        schema: TSchema,
        hooks: ModelWriteHooks<PersistedModelOutput<TSchema>> | undefined,
        normalizedRelations: readonly NormalizedRelationStorageDescriptor[],
        explicitFields: readonly Field[] | undefined,
        explicitRelations: Readonly<Record<string, RelationDef>> | undefined
    ) {
        this.registry = registry;
        this.metadata = metadata;
        this.schema = schema;
        this.hooks = hooks;
        this.normalizedRelations = Object.freeze([...normalizedRelations]);
        this.explicitFields = explicitFields ? Object.freeze([...explicitFields]) : undefined;
        this.explicitRelations = explicitRelations;
    }

    static create<TSchema extends z.ZodObject<z.ZodRawShape>>(
        definition: ModelDefinition<TSchema>,
        registry: ModelRegistry
    ): InternalSchemaModel<TSchema> {
        InternalSchemaModel.validateDefinition(definition);

        const builder = new RelationBuilder();
        const relations = definition.relations ? Object.freeze(definition.relations(builder)) : undefined;
        const key = `${definition.namespace}/${definition.name}`;
        const table = definition.table?.trim() || deriveTableName(definition.name);
        const normalizedRelations = RelationDescriptorNormalizer.normalize(key, definition.schema);

        const metadata: ModelMetadata = {
            namespace: definition.namespace,
            name: definition.name,
            key,
            table,
            fields: [] as never,
            indexes: definition.indexes,
            relations,
            ordering: definition.ordering,
            managed: definition.managed,
            defaultRelatedName: definition.defaultRelatedName,
            constraints: definition.constraints,
        };

        // The field view stays lazy because finalized storage metadata is registry-scoped.
        // The owning registry publishes the current finalized fields for this model
        // instead of freezing a stale one-time snapshot during construction.
        Object.defineProperty(metadata, 'fields', {
            enumerable: true,
            configurable: false,
            get: () => registry.getFinalizedFields(key) as typeof metadata.fields,
        });
        Object.freeze(metadata);

        return new InternalSchemaModel(
            registry,
            metadata,
            definition.schema,
            definition.hooks,
            normalizedRelations,
            definition.fields,
            relations
        );
    }

    static isInternalSchemaModel(value: unknown): value is AnyInternalSchemaModel {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === InternalSchemaModel.BRAND
        );
    }

    static getRegistryOwner(model: AnySchemaModel): ModelRegistry {
        return InternalSchemaModel.require(model).registry;
    }

    static getNormalizedRelations(model: AnySchemaModel): readonly NormalizedRelationStorageDescriptor[] {
        return InternalSchemaModel.require(model).normalizedRelations;
    }

    static getExplicitFields(model: AnySchemaModel): readonly Field[] | undefined {
        return InternalSchemaModel.require(model).explicitFields;
    }

    static getExplicitRelations(model: AnySchemaModel): Readonly<Record<string, RelationDef>> | undefined {
        return InternalSchemaModel.require(model).explicitRelations;
    }

    private static validateDefinition<TSchema extends z.ZodObject<z.ZodRawShape>>(
        definition: ModelDefinition<TSchema>
    ): void {
        if (!definition.namespace.trim()) {
            throw new Error('Model.namespace is required and cannot be empty.');
        }
        if (!definition.name.trim()) {
            throw new Error('Model.name is required and cannot be empty.');
        }
        if (definition.table !== undefined && !definition.table.trim()) {
            throw new Error('Model.table cannot be empty when provided.');
        }
    }

    private static require(model: AnySchemaModel): AnyInternalSchemaModel {
        if (!InternalSchemaModel.isInternalSchemaModel(model)) {
            throw new Error(`Model '${model.metadata.key}' is missing internal registry ownership metadata.`);
        }

        return model;
    }
}
