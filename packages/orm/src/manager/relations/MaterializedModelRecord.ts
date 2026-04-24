import type { z } from 'zod';
import type { Model, PersistedModelOutput } from '@danceroutine/tango-schema/domain';
import type {
    DecoratedFieldKind,
    InternalDecoratedFieldKind,
    RelationDecoratedSchema,
} from '@danceroutine/tango-schema/model';
import type { ManyToManyRelatedManager } from './ManyToManyRelatedManager';

// Detects the TypeScript `any` type without collapsing to it. Used below so
// that a stray `any` in a schema shape does not masquerade as a decorated
// relation field and silently pollute the resulting manager map.
type IsAny<TValue> = 0 extends 1 & TValue ? true : false;

// Loosest possible schema-model shape. The individual inference helpers below
// only care that a target is "some registered model", not what columns live
// on it, so narrowing further would reject valid targets.
type AnyModel = Model<z.ZodObject<z.ZodRawShape>, string>;

// Extract the underlying Zod shape object from a model's schema so we can
// iterate over its keys at the type level. Returns `never` for inputs that
// are not Zod object schemas.
type SchemaShape<TSchema> = TSchema extends z.ZodObject<infer TShape> ? TShape : never;

// Walk a Zod field wrapped with `RelationDecoratedSchema` and recover the
// decorated relation kind (`manyToMany`, `belongsTo`, ...). Non-decorated
// fields fall through to `never`.
type RelationKindOf<TField> =
    TField extends RelationDecoratedSchema<
        z.ZodTypeAny,
        infer TKind extends DecoratedFieldKind,
        AnyModel,
        string | undefined,
        string | undefined
    >
        ? TKind
        : never;

// Mirror of `RelationKindOf` that recovers the target model type instead of
// the relation kind. Together they let the later helpers pair "is this a
// m2m field" with "what model does it point at".
type RelationTarget<TField> =
    TField extends RelationDecoratedSchema<
        z.ZodTypeAny,
        DecoratedFieldKind,
        infer TTarget,
        string | undefined,
        string | undefined
    >
        ? TTarget
        : never;

type RelationPublishedName<TField, TFallback extends string> =
    TField extends RelationDecoratedSchema<
        z.ZodTypeAny,
        DecoratedFieldKind,
        AnyModel,
        infer TName extends string | undefined,
        string | undefined
    >
        ? TName extends string
            ? TName
            : TFallback
        : TFallback;

// Given a target `Model`, produce the persisted row shape the ORM hands back
// after SQL reads. `ManyToManyRelatedManager` is parameterized on this row
// shape so `all().fetch()` types match the rest of the ORM.
type ModelRow<TTarget> =
    TTarget extends Model<infer TSchema extends z.ZodObject<z.ZodRawShape>, string>
        ? PersistedModelOutput<TSchema>
        : never;

// Pick out only the schema keys whose decorated kind is `manyToMany`. The
// chain is:
//   1. Skip raw `any` fields (they would otherwise widen to every key).
//   2. Skip non-decorated fields (no relation kind → `never`).
//   3. Keep the key iff the decorated kind is `manyToMany`.
// The outer `Extract<..., string>` narrows symbol/number keys away so the
// downstream mapped type can use `readonly [K in ...]` safely.
type ManyToManyKeysOfShape<TShape extends z.ZodRawShape> = Extract<
    {
        [K in keyof TShape]: IsAny<TShape[K]> extends true
            ? never
            : [RelationKindOf<TShape[K]>] extends [never]
              ? never
              : [RelationKindOf<TShape[K]>] extends [typeof InternalDecoratedFieldKind.MANY_TO_MANY]
                ? K
                : never;
    }[keyof TShape],
    string
>;

// Project the filtered m2m keys into `ManyToManyRelatedManager<TargetRow>`
// properties. The nested conditionals keep TypeScript happy in the face of
// the heavily generic `RelationDecoratedSchema` type while still producing a
// clean `{ tags: ManyToManyRelatedManager<TagRow>; ... }` shape at the call
// site.
type ManyToManyManagers<TShape extends z.ZodRawShape> = {
    readonly [K in ManyToManyKeysOfShape<TShape> as K extends keyof TShape
        ? RelationPublishedName<TShape[K], K>
        : never]: K extends keyof TShape
        ? RelationTarget<TShape[K]> extends AnyModel
            ? ManyToManyRelatedManager<ModelRow<RelationTarget<TShape[K]>>>
            : never
        : never;
};

/**
 * Persisted model record shape returned by ORM read and write paths.
 *
 * Combines the column-level {@link PersistedModelOutput} with a per-relation
 * {@link ManyToManyRelatedManager} for every many-to-many field declared on the
 * source schema. The manager properties are attached as non-enumerable accessors
 * at runtime, so `JSON.stringify` and structural equality checks only see the
 * column data.
 */
export type MaterializedModelRecord<TSchema extends z.ZodObject<z.ZodRawShape>> = PersistedModelOutput<TSchema> &
    ManyToManyManagers<SchemaShape<TSchema>>;
