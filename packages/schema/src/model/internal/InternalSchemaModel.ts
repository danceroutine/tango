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
const REGISTRY_OWNER_KEY = Symbol.for('tango.schema.registryOwner');
const NORMALIZED_RELATIONS_KEY = Symbol.for('tango.schema.normalizedRelations');
const EXPLICIT_FIELDS_KEY = Symbol.for('tango.schema.explicitFields');
const EXPLICIT_RELATIONS_KEY = Symbol.for('tango.schema.explicitRelations');

type InternalSchemaModelCarrier = object & {
    [REGISTRY_OWNER_KEY]?: ModelRegistry;
    [NORMALIZED_RELATIONS_KEY]?: readonly NormalizedRelationStorageDescriptor[];
    [EXPLICIT_FIELDS_KEY]?: readonly Field[];
    [EXPLICIT_RELATIONS_KEY]?: Readonly<Record<string, RelationDef>>;
};

export class InternalSchemaModel<
    TSchema extends z.ZodObject<z.ZodRawShape>,
    TKey extends string = string,
> implements Model<TSchema, TKey> {
    static readonly BRAND = 'tango.schema.internal_schema_model' as const;

    readonly __tangoBrand: typeof InternalSchemaModel.BRAND = InternalSchemaModel.BRAND;
    readonly metadata: ModelMetadata;
    readonly schema: TSchema;
    readonly hooks?: ModelWriteHooks<PersistedModelOutput<TSchema>>;
    declare readonly objects: ModelAugmentations<TSchema, TKey> extends { readonly objects: infer TObject }
        ? TObject
        : never;

    private constructor(
        metadata: ModelMetadata,
        schema: TSchema,
        hooks: ModelWriteHooks<PersistedModelOutput<TSchema>> | undefined
    ) {
        this.metadata = metadata;
        this.schema = schema;
        this.hooks = hooks;
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

        const model = new InternalSchemaModel(metadata, definition.schema, definition.hooks);
        InternalSchemaModel.attachInternals(model, {
            registry,
            normalizedRelations,
            explicitFields: definition.fields,
            explicitRelations: relations,
        });
        return model;
    }

    static isInternalSchemaModel(value: unknown): value is AnyInternalSchemaModel {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === InternalSchemaModel.BRAND
        );
    }

    static getRegistryOwner(model: AnySchemaModel): ModelRegistry {
        const owner = InternalSchemaModel.carrier(model)[REGISTRY_OWNER_KEY];
        if (!owner) {
            throw new Error(`Model '${model.metadata.key}' is missing internal registry ownership metadata.`);
        }
        return owner;
    }

    static getNormalizedRelations(model: AnySchemaModel): readonly NormalizedRelationStorageDescriptor[] {
        return InternalSchemaModel.carrier(model)[NORMALIZED_RELATIONS_KEY] ?? [];
    }

    static getExplicitFields(model: AnySchemaModel): readonly Field[] | undefined {
        return InternalSchemaModel.carrier(model)[EXPLICIT_FIELDS_KEY];
    }

    static getExplicitRelations(model: AnySchemaModel): Readonly<Record<string, RelationDef>> | undefined {
        return InternalSchemaModel.carrier(model)[EXPLICIT_RELATIONS_KEY];
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

    private static carrier(model: AnySchemaModel): InternalSchemaModelCarrier {
        return InternalSchemaModel.require(model) as unknown as InternalSchemaModelCarrier;
    }

    private static attachInternals(
        model: object,
        internals: {
            registry: ModelRegistry;
            normalizedRelations: readonly NormalizedRelationStorageDescriptor[];
            explicitFields?: readonly Field[];
            explicitRelations?: Readonly<Record<string, RelationDef>>;
        }
    ): void {
        const carrier = model as InternalSchemaModelCarrier;

        Object.defineProperties(carrier, {
            [REGISTRY_OWNER_KEY]: {
                value: internals.registry,
                enumerable: false,
                configurable: false,
                writable: false,
            },
            [NORMALIZED_RELATIONS_KEY]: {
                value: Object.freeze([...internals.normalizedRelations]),
                enumerable: false,
                configurable: false,
                writable: false,
            },
            [EXPLICIT_FIELDS_KEY]: {
                value: internals.explicitFields ? Object.freeze([...internals.explicitFields]) : undefined,
                enumerable: false,
                configurable: false,
                writable: false,
            },
            [EXPLICIT_RELATIONS_KEY]: {
                value: internals.explicitRelations,
                enumerable: false,
                configurable: false,
                writable: false,
            },
        });
    }
}
