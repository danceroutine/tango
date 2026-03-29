import type { Model } from '../../domain/index';
import type { ModelRef } from '../decorators/types';

/**
 * Registry that resolves Tango models by stable identity.
 *
 * The global registry is convenient for application bootstrapping, while
 * dedicated instances are useful in tests and tooling.
 */
export class ModelRegistry {
    private static globalRegistry?: ModelRegistry;
    private readonly models = new Map<string, Model>();

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
     * Register a model on this registry instance.
     */
    register(model: Model): void {
        this.models.set(model.metadata.key, model);
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

        if (typeof ref === 'function') {
            return ref();
        }

        return ref;
    }

    /**
     * Remove all registered models from this registry instance.
     */
    clear(): void {
        this.models.clear();
    }

    /**
     * Return all registered models in insertion order.
     */
    values(): readonly Model[] {
        return Array.from(this.models.values());
    }
}
