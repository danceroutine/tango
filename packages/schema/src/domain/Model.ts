import type { z } from 'zod';
import type { ModelMetadata } from './ModelMetadata';
import type { ModelWriteHooks } from './ModelWriteHooks';
import { InternalDecoratedFieldKind } from '../model/decorators/domain/DecoratedFieldKind';
import type { RelationDecoratedSchemaKind } from '../model/decorators/domain/RelationDecoratedSchema';

declare const MODEL_AUGMENTATION_SCHEMA: unique symbol;
declare const MODEL_KEY: unique symbol;

type ModelAugmentationCarrier<TSchema extends z.ZodObject<z.ZodRawShape>> = {
    readonly [MODEL_AUGMENTATION_SCHEMA]?: TSchema;
};

type ModelKeyCarrier<TKey extends string> = {
    readonly [MODEL_KEY]?: TKey;
};

type IsAny<TValue> = 0 extends 1 & TValue ? true : false;

declare global {
    interface TangoSchemaModelAugmentations<
        TSchema extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>,
        TKey extends string = string,
        // oxlint-disable-next-line no-empty-object-type
    > {}
}

type ManyToManyFieldKeys<TShape extends z.ZodRawShape> = {
    [K in keyof TShape]: IsAny<TShape[K]> extends true
        ? never
        : [RelationDecoratedSchemaKind<TShape[K]>] extends [never]
          ? never
          : [RelationDecoratedSchemaKind<TShape[K]>] extends [typeof InternalDecoratedFieldKind.MANY_TO_MANY]
            ? K
            : never;
}[keyof TShape];

type PersistedShape<TShape extends z.ZodRawShape> = Omit<z.output<z.ZodObject<TShape>>, ManyToManyFieldKeys<TShape>>;

export type PersistedModelOutput<TSchema extends z.ZodObject<z.ZodRawShape>> =
    TSchema extends z.ZodObject<infer TShape> ? PersistedShape<TShape> : z.output<TSchema>;

export interface ModelAugmentations<
    TSchema extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>,
    TKey extends string = string,
>
    extends ModelAugmentationCarrier<TSchema>, ModelKeyCarrier<TKey>, TangoSchemaModelAugmentations<TSchema, TKey> {}

export interface Model<
    TSchema extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>,
    TKey extends string = string,
> extends ModelAugmentations<TSchema, TKey> {
    metadata: ModelMetadata;
    schema: TSchema;
    /**
     * Model-owned write lifecycle hooks preserved from the definition.
     */
    hooks?: ModelWriteHooks<PersistedModelOutput<TSchema>>;
}

export type ModelKeyOf<TModel> = TModel extends Model<z.ZodObject<z.ZodRawShape>, infer TKey> ? TKey : never;
