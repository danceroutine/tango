import type { z } from 'zod';
import type { ModelMetadata } from './ModelMetadata';
import type { ModelWriteHooks } from './ModelWriteHooks';

declare const MODEL_AUGMENTATION_SCHEMA: unique symbol;

type ModelAugmentationCarrier<TSchema extends z.ZodObject<z.ZodRawShape>> = {
    readonly [MODEL_AUGMENTATION_SCHEMA]?: TSchema;
};

declare global {
    // oxlint-disable-next-line no-empty-object-type
    interface TangoSchemaModelAugmentations<TSchema extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>> {}
}

export interface ModelAugmentations<TSchema extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>>
    extends ModelAugmentationCarrier<TSchema>,
        TangoSchemaModelAugmentations<TSchema> {}

export interface Model<TSchema extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>>
    extends ModelAugmentations<TSchema> {
    metadata: ModelMetadata;
    schema: TSchema;
    /**
     * Model-owned write lifecycle hooks preserved from the definition.
     */
    hooks?: ModelWriteHooks<z.output<TSchema>>;
}
