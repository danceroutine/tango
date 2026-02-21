import type { z } from 'zod';
import type { Model } from '../domain/Model';
import { ModelRegistry } from './registry/ModelRegistry';

export type ModelAugmentor = <TSchema extends z.ZodObject<z.ZodRawShape>>(model: Model<TSchema>) => void;

const modelAugmentors = new Set<ModelAugmentor>();

/**
 * Register a model augmentor that runs for existing and future models.
 */
export function registerModelAugmentor(augmentor: ModelAugmentor): () => void {
    modelAugmentors.add(augmentor);

    for (const model of ModelRegistry.global().values()) {
        augmentor(model);
    }

    return () => {
        modelAugmentors.delete(augmentor);
    };
}

/**
 * Apply all registered augmentors to a model before it is returned publicly.
 */
export function applyModelAugmentors<TSchema extends z.ZodObject<z.ZodRawShape>>(
    model: Model<TSchema>
): Model<TSchema> {
    for (const augmentor of modelAugmentors) {
        augmentor(model);
    }

    return model;
}
