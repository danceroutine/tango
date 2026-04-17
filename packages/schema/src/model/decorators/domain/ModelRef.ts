import type { Model, ModelKeyOf } from '../../../domain';

// TODO: consider async model callbacks such as `() => Promise<Model>` when Tango tackles lazy import boundaries for cyclical model graphs.
// See the ADR: https://tangowebframework.dev/contributors/adr/deep-relation-hydration-with-generated-path-typing
declare const TANGO_TYPED_MODEL_REF_TARGET: unique symbol;

export interface TypedModelRef<TModel extends Model = Model> {
    readonly key: ModelKeyOf<TModel>;
    readonly [TANGO_TYPED_MODEL_REF_TARGET]?: TModel;
}

export type ModelRef<TModel extends Model = Model> = string | TModel | (() => TModel) | TypedModelRef<TModel>;

export type ModelRefTarget<TRef> =
    TRef extends TypedModelRef<infer TModel>
        ? TModel
        : TRef extends () => infer TModel
          ? TModel extends Model
              ? TModel
              : never
          : TRef extends Model
            ? TRef
            : never;

export function createTypedModelRef<TModel extends Model>(key: ModelKeyOf<TModel>): TypedModelRef<TModel> {
    return Object.freeze({ key }) as TypedModelRef<TModel>;
}

export function isTypedModelRef(value: unknown): value is TypedModelRef {
    return typeof value === 'object' && value !== null && typeof (value as { key?: unknown }).key === 'string';
}
