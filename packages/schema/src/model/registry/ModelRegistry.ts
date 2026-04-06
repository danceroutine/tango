import { AsyncLocalStorage } from 'node:async_hooks';
import type { Field, Model } from '../../domain/index';
import type { ZodTypeAny } from '../decorators/domain/ZodTypeAny';
import type { ModelRef } from '../decorators/domain/ModelRef';
import { inferFieldsFromSchema } from '../fields/inferFieldsFromSchema';
import { getFieldMetadata } from '../fields/FieldMetadataStore';
import type { FinalizedStorageArtifacts, FinalizedStorageModel } from '../fields/FinalizedStorageArtifacts';
import { InternalSchemaModel } from '../internal/InternalSchemaModel';
import type { ResolvedRelationGraph } from '../relations/ResolvedRelationGraph';
import { ResolvedRelationGraphBuilder } from '../relations/ResolvedRelationGraphBuilder';

const DEFAULT_IDENTIFIER_NAME = 'id';
const activeRegistryStorage = new AsyncLocalStorage<ModelRegistry>();

/**
 * Registry that resolves Tango models by stable identity.
 *
 * The global registry is convenient for application bootstrapping, while
 * dedicated instances are useful in tests and tooling.
 */
export class ModelRegistry {
    private static globalRegistry?: ModelRegistry;
    private readonly models = new Map<string, Model>();
    private version = 0;
    private storageCache?: FinalizedStorageArtifacts;
    private relationGraphCache?: ResolvedRelationGraph;

    /**
     * Return the shared process-wide registry used by `Model(...)`.
     */
    static global(): ModelRegistry {
        if (!ModelRegistry.globalRegistry) {
            ModelRegistry.globalRegistry = new ModelRegistry();
        }
        return ModelRegistry.globalRegistry;
    }

    /**
     * Return the registry currently bound to model construction work.
     */
    static active(): ModelRegistry {
        return activeRegistryStorage.getStore() ?? ModelRegistry.global();
    }

    /**
     * Run work with a specific registry bound as the active construction target.
     */
    static async runWithRegistry<T>(registry: ModelRegistry, work: () => Promise<T> | T): Promise<T> {
        return await activeRegistryStorage.run(registry, work);
    }

    /**
     * Register a model on the shared global registry.
     */
    static register(model: Model): void {
        ModelRegistry.global().register(model);
    }

    /**
     * Register several models on the shared global registry.
     */
    static registerMany(models: readonly Model[]): void {
        ModelRegistry.global().registerMany(models);
    }

    /**
     * Resolve a model from the shared registry by namespace and name.
     */
    static get(namespace: string, name: string): Model | undefined {
        return ModelRegistry.global().get(namespace, name);
    }

    /**
     * Resolve a model from the shared registry by its `namespace/name` key.
     */
    static getByKey(key: string): Model | undefined {
        return ModelRegistry.global().getByKey(key);
    }

    /**
     * Resolve any supported model reference form against the shared registry.
     */
    static resolveRef(ref: ModelRef): Model {
        return ModelRegistry.global().resolveRef(ref);
    }

    /**
     * Clear the shared registry, which is mainly useful in tests.
     */
    static clear(): void {
        ModelRegistry.global().clear();
    }

    /**
     * Return the owning registry for a model.
     */
    static getOwner(model: Model): ModelRegistry {
        return InternalSchemaModel.getRegistryOwner(model);
    }

    /**
     * Register a model on this registry instance.
     */
    register(model: Model): void {
        // A model's finalized storage and relation artifacts are registry-scoped.
        // Rejecting cross-registry reuse here prevents one model object from
        // publishing conflicting finalized views in multiple registries.
        const owner = InternalSchemaModel.getRegistryOwner(model);
        if (owner !== this) {
            throw new Error(
                `Model '${model.metadata.key}' belongs to a different registry and cannot be registered here.`
            );
        }

        const existing = this.models.get(model.metadata.key);
        if (existing && existing !== model) {
            throw new Error(`Model '${model.metadata.key}' is already registered in this registry.`);
        }

        this.models.set(model.metadata.key, model);
        this.bumpVersion();
    }

    /**
     * Register several models on this registry instance.
     */
    registerMany(models: readonly Model[]): void {
        for (const model of models) {
            this.register(model);
        }
    }

    /**
     * Resolve a model from this registry instance by namespace and name.
     */
    get(namespace: string, name: string): Model | undefined {
        return this.getByKey(`${namespace}/${name}`);
    }

    /**
     * Resolve a model from this registry instance by its `namespace/name` key.
     */
    getByKey(key: string): Model | undefined {
        return this.models.get(key);
    }

    /**
     * Resolve a string, callback, or direct model reference into a model object.
     */
    resolveRef(ref: ModelRef): Model {
        if (typeof ref === 'string') {
            const model = this.getByKey(ref);
            if (!model) {
                throw new Error(
                    `Unable to resolve model reference '${ref}'. Ensure it is registered in ModelRegistry.`
                );
            }
            return model;
        }

        const model = typeof ref === 'function' ? ref() : ref;
        if (InternalSchemaModel.getRegistryOwner(model) !== this) {
            throw new Error(
                `Model reference '${model.metadata.key}' belongs to a different registry and cannot be resolved here.`
            );
        }
        return model;
    }

    /**
     * Finalize storage-only artifacts for all models in this registry.
     */
    finalizeStorageArtifacts(): FinalizedStorageArtifacts {
        if (this.storageCache?.version === this.version) {
            return this.storageCache;
        }

        const primaryKeyByModel = new Map<string, string>();
        for (const model of this.models.values()) {
            primaryKeyByModel.set(model.metadata.key, this.inferPrimaryKeyName(model));
        }

        const byModel = new Map<string, FinalizedStorageModel>();
        for (const model of this.models.values()) {
            const explicitFields = InternalSchemaModel.getExplicitFields(model);
            const inferredFields = inferFieldsFromSchema(model.schema, {
                registry: this,
                resolveReferenceTarget: (target) => {
                    const targetModel = this.resolveRef(target);
                    return {
                        table: targetModel.metadata.table,
                        pk: primaryKeyByModel.get(targetModel.metadata.key)!,
                    };
                },
            });
            const fields = this.freezeFields(this.mergeStorageFields(inferredFields, explicitFields));
            const primaryKey = fields.find((field) => field.primaryKey)?.name ?? DEFAULT_IDENTIFIER_NAME;

            byModel.set(model.metadata.key, {
                key: model.metadata.key,
                table: model.metadata.table,
                fields,
                pk: primaryKey,
            });
        }

        const finalized: FinalizedStorageArtifacts = {
            version: this.version,
            byModel,
        };
        this.storageCache = finalized;
        return finalized;
    }

    /**
     * Return finalized storage fields for a specific model.
     */
    getFinalizedFields(model: Model | string): readonly Field[] {
        const key = typeof model === 'string' ? model : model.metadata.key;
        const fields = this.finalizeStorageArtifacts().byModel.get(key)?.fields;
        if (!fields) {
            throw new Error(`No finalized storage fields are available for model '${key}'.`);
        }
        return fields;
    }

    /**
     * Resolve the registry's relation graph from finalized storage artifacts.
     */
    getResolvedRelationGraph(): ResolvedRelationGraph {
        if (this.relationGraphCache?.version === this.version) {
            return this.relationGraphCache;
        }

        // The registry owns cache/version orchestration. The dedicated builder owns
        // forward edge resolution, reverse synthesis, and override validation.
        const finalized = ResolvedRelationGraphBuilder.build({
            version: this.version,
            models: this.values(),
            storage: this.finalizeStorageArtifacts(),
            resolveRef: (ref) => this.resolveRef(ref),
        });
        this.relationGraphCache = finalized;
        return finalized;
    }

    /**
     * Remove all registered models from this registry instance.
     */
    clear(): void {
        this.models.clear();
        this.bumpVersion();
    }

    /**
     * Return all registered models in insertion order.
     */
    values(): readonly Model[] {
        return Array.from(this.models.values());
    }

    private bumpVersion(): void {
        this.version += 1;
        this.storageCache = undefined;
        this.relationGraphCache = undefined;
    }

    private freezeFields(fields: readonly Field[]): readonly Field[] {
        return Object.freeze(fields.map((field) => Object.freeze({ ...field })));
    }

    private inferPrimaryKeyName(model: Model): string {
        for (const [fieldKey, zodType] of Object.entries(model.schema.shape)) {
            const meta = getFieldMetadata(zodType as ZodTypeAny);
            if (meta?.primaryKey) {
                return meta.dbColumn ?? fieldKey;
            }
        }

        const explicitFields = InternalSchemaModel.getExplicitFields(model);
        if (explicitFields) {
            return explicitFields.find((field) => field.primaryKey)?.name ?? DEFAULT_IDENTIFIER_NAME;
        }

        return DEFAULT_IDENTIFIER_NAME;
    }

    private mergeStorageFields(inferredFields: readonly Field[], explicitFields?: readonly Field[]): readonly Field[] {
        if (!explicitFields?.length) {
            return inferredFields;
        }

        const mergedFields = new Map(inferredFields.map((field) => [field.name, field]));
        for (const explicitField of explicitFields) {
            mergedFields.set(explicitField.name, explicitField);
        }

        return Array.from(mergedFields.values());
    }
}
