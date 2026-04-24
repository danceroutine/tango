import type { z } from 'zod';
import type { Model, PersistedModelOutput } from '@danceroutine/tango-schema/domain';
import type {
    DecoratedFieldKind,
    InternalDecoratedFieldKind,
    RelationDecoratedSchema,
} from '@danceroutine/tango-schema/model';
import type { ManyToManyRelatedManager } from '../../manager/relations/ManyToManyRelatedManager';

export const InternalRelationHydrationCardinality = {
    SINGLE: 'single',
    MANY: 'many',
} as const;

export type RelationHydrationCardinality =
    (typeof InternalRelationHydrationCardinality)[keyof typeof InternalRelationHydrationCardinality];
export type SingleRelationHydrationCardinality = typeof InternalRelationHydrationCardinality.SINGLE;
export type ManyRelationHydrationCardinality = typeof InternalRelationHydrationCardinality.MANY;

export type HydratedQueryResult<TBase extends Record<string, unknown>, THydrated extends Record<string, unknown>> =
    // No relation hydration requested: keep the base projection exactly as-is.
    [keyof THydrated] extends [never] ? TBase : Omit<TBase, keyof THydrated> & THydrated;

declare global {
    // oxlint-disable-next-line no-empty-object-type
    interface TangoGeneratedRelationRegistry {}
}

// A model's own schema is the only source TypeScript can inspect without codegen or an ambient registry.
// These helpers progressively peel that schema apart into field definitions and persisted row shapes.
// "AnyModel" is a structural upper bound for model values when the exact schema/key is not important.
type AnyModel = Model<z.ZodObject<z.ZodRawShape>, string>;
// If the caller gave us a Tango Model type, infer the Zod schema type stored inside it.
type ModelSchema<TModel> =
    TModel extends Model<infer TSchema extends z.ZodObject<z.ZodRawShape>, string> ? TSchema : never;
// If we have a Zod object schema, infer its raw object shape so we can inspect individual fields.
type ModelShape<TModel> = ModelSchema<TModel> extends z.ZodObject<infer TShape> ? TShape : never;
// Convert the inferred model schema back into the persisted row shape applications receive from the ORM.
type ModelRow<TModel> =
    TModel extends Model<infer TSchema extends z.ZodObject<z.ZodRawShape>, string>
        ? PersistedModelOutput<TSchema>
        : never;

// Relation typing only works when model keys remain literal. Once a model key widens to plain string,
// TypeScript can no longer prove that one relation target matches another model.
// This conditional rejects widened strings while accepting literal keys such as "blog/User".
type IsLiteralString<TValue> = TValue extends string ? (string extends TValue ? false : true) : false;
// A model has strict relation typing only when its model key is still a literal type.
type HasStrictModelKey<TModel> =
    TModel extends Model<z.ZodObject<z.ZodRawShape>, infer TKey> ? IsLiteralString<TKey> : false;

// Extract the literal model key from a Tango Model type. The generated
// relation registry is indexed by these stable ids.
type ModelKey<TModel> = TModel extends Model<z.ZodObject<z.ZodRawShape>, infer TKey extends string> ? TKey : never;

// Merge one-hydration-per-path object fragments into one final hydrated map.
type UnionToIntersection<TValue> = (TValue extends unknown ? (value: TValue) => void : never) extends (
    value: infer TIntersection
) => void
    ? TIntersection
    : never;

type JoinPathSegments<TSegments extends readonly string[]> = TSegments extends readonly [
    infer THead extends string,
    ...infer TRest extends string[],
]
    ? TRest['length'] extends 0
        ? THead
        : `${THead}__${JoinPathSegments<TRest>}`
    : never;

// Split a Django-style path into tuple segments so recursive conditional types
// can walk one relation hop at a time.
type SplitPath<TPath extends string> = TPath extends `${infer THead}__${infer TRest}`
    ? [THead, ...SplitPath<TRest>]
    : [TPath];

type TailTuple<TTuple extends readonly unknown[]> = TTuple extends readonly [unknown, ...infer TRest] ? TRest : [];
// Generated typing allows four recursive revisits before it falls back to
// weaker typing. Runtime traversal can still go deeper than this budget.
type DefaultGeneratedCycleBudget = readonly [1, 1, 1, 1];
type GeneratedRelationRegistry = TangoGeneratedRelationRegistry;
type GeneratedRelationKeys<TSourceModel> = Extract<keyof GeneratedRelations<TSourceModel>, string>;

// Only read from the ambient generated registry when the caller supplied a
// model whose key remains a literal type.
type GeneratedRelations<TSourceModel> =
    HasStrictModelKey<TSourceModel> extends true
        ? ModelKey<TSourceModel> extends keyof GeneratedRelationRegistry
            ? GeneratedRelationRegistry[ModelKey<TSourceModel>]
            : // oxlint-disable-next-line typescript/ban-types, typescript/no-empty-object-type
              {}
        : // oxlint-disable-next-line typescript/ban-types, typescript/no-empty-object-type
          {};

type NextSeenModels<TSeen extends readonly string[], TTargetModel> =
    ModelKey<TTargetModel> extends string ? [...TSeen, ModelKey<TTargetModel>] : TSeen;

// Revisiting a model is allowed while the cycle budget still has entries.
type CanTraverseGeneratedTarget<
    TTargetModel,
    TSeen extends readonly string[],
    TCycleBudget extends readonly unknown[],
> = ModelKey<TTargetModel> extends TSeen[number] ? (TCycleBudget extends [] ? false : true) : true;

// Only consume budget when the next edge revisits a model already on the path.
type NextGeneratedCycleBudget<TTargetModel, TSeen extends readonly string[], TCycleBudget extends readonly unknown[]> =
    ModelKey<TTargetModel> extends TSeen[number] ? TailTuple<TCycleBudget> : TCycleBudget;

type GeneratedCardinalityIncludesMany<TCardinality extends RelationHydrationCardinality> =
    TCardinality extends typeof InternalRelationHydrationCardinality.MANY ? true : false;

/**
 * Generated path keys accepted by `selectRelated(...)`.
 *
 * Walks the ambient relation registry one hop at a time. Each hop contributes:
 *   (a) the bare relation key (e.g. `author`) as a valid path terminus, and
 *   (b) a dunder-joined extension (`author__profile`, ...) that recurses into
 *       the target model.
 *
 * Because `selectRelated` only composes single-valued hops, the mapped type
 * filters relations whose `cardinality` is not `SINGLE`. The `TSeen` tuple
 * tracks which model keys the recursion has visited so cyclic schemas
 * (`manager -> manager`) are allowed a bounded number of revisits before
 * typing falls back to `never`. `TCycleBudget` is that revisit budget; see
 * `CanTraverseGeneratedTarget` / `NextGeneratedCycleBudget` for how it
 * shrinks only when the next hop actually re-enters a seen model.
 */
export type GeneratedSelectRelatedPathKeys<
    TSourceModel,
    TSeen extends readonly string[] = [ModelKey<TSourceModel>],
    TCycleBudget extends readonly unknown[] = DefaultGeneratedCycleBudget,
> = {
    [TKey in GeneratedRelationKeys<TSourceModel>]: GeneratedRelations<TSourceModel>[TKey] extends {
        target: infer TTarget extends AnyModel;
        cardinality: typeof InternalRelationHydrationCardinality.SINGLE;
    }
        ?
              | TKey
              | (CanTraverseGeneratedTarget<TTarget, TSeen, TCycleBudget> extends true
                    ? `${TKey}__${GeneratedSelectRelatedPathKeys<
                          TTarget,
                          NextSeenModels<TSeen, TTarget>,
                          NextGeneratedCycleBudget<TTarget, TSeen, TCycleBudget>
                      >}`
                    : never)
        : never;
}[GeneratedRelationKeys<TSourceModel>];

/**
 * Generated path keys accepted by `prefetchRelated(...)`.
 *
 * Similar in shape to {@link GeneratedSelectRelatedPathKeys}, but relaxes two
 * constraints because prefetch can cross and continue past collection edges:
 *   1. Any hop whose cardinality is `MANY` is a valid terminus. The
 *      `THasMany` flag threads through recursion so once a collection edge
 *      has been crossed, every subsequent hop is also a valid terminus
 *      (matches Django's `prefetch_related` semantics).
 *   2. Single-valued hops are still accepted as terminators so paths like
 *      `posts__author` survive the join.
 *
 * Cycle handling reuses the same `TSeen` / `TCycleBudget` machinery described
 * in {@link GeneratedSelectRelatedPathKeys}: cyclic schemas are typed up to
 * the bound, then fall back to weaker typing rather than failing.
 */
export type GeneratedPrefetchRelatedPathKeys<
    TSourceModel,
    THasMany extends boolean = false,
    TSeen extends readonly string[] = [ModelKey<TSourceModel>],
    TCycleBudget extends readonly unknown[] = DefaultGeneratedCycleBudget,
> = {
    [TKey in GeneratedRelationKeys<TSourceModel>]: GeneratedRelations<TSourceModel>[TKey] extends {
        target: infer TTarget extends AnyModel;
        cardinality: infer TCardinality extends RelationHydrationCardinality;
    }
        ?
              | (THasMany extends true
                    ? TKey
                    : GeneratedCardinalityIncludesMany<TCardinality> extends true
                      ? TKey
                      : never)
              | (CanTraverseGeneratedTarget<TTarget, TSeen, TCycleBudget> extends true
                    ? `${TKey}__${GeneratedPrefetchRelatedPathKeys<
                          TTarget,
                          THasMany extends true ? true : GeneratedCardinalityIncludesMany<TCardinality>,
                          NextSeenModels<TSeen, TTarget>,
                          NextGeneratedCycleBudget<TTarget, TSeen, TCycleBudget>
                      >}`
                    : never)
        : never;
}[GeneratedRelationKeys<TSourceModel>];

/**
 * Generated relation-path filter keys accepted by `filter(...)`, `exclude(...)`,
 * and `Q(...)`.
 *
 * This stays intentionally lighter than the eager-loading path typing:
 * applications with generated relation registries get completion for the
 * relation path prefix, while the terminal field and lookup suffix remain a
 * string tail so the compiler does not explode on deep recursive field
 * extraction.
 */
export type GeneratedRelationFilterKeys<TSourceModel> =
    | `${GeneratedSelectRelatedPathKeys<TSourceModel>}__${string}`
    | `${GeneratedPrefetchRelatedPathKeys<TSourceModel>}__${string}`;

// Hydrated target values recurse through the remaining path suffix, so a path
// like `posts__author` becomes `{ posts: Array<{ author: ... }> }`.
type GeneratedHydratedTarget<TDescriptor, TPath extends string | never> = TDescriptor extends {
    target: infer TTarget extends AnyModel;
}
    ? [TPath] extends [never]
        ? ModelRow<TTarget>
        : HydratedQueryResult<ModelRow<TTarget>, GeneratedHydratedRelationMap<TTarget, TPath>>
    : never;

type GeneratedHydratedValue<TDescriptor, TPath extends string | never> = TDescriptor extends {
    target: infer TTarget extends AnyModel;
    kind: 'manyToMany';
}
    ? ManyToManyRelatedManager<ModelRow<TTarget>>
    : TDescriptor extends { cardinality: infer TCardinality extends RelationHydrationCardinality }
      ? TCardinality extends typeof InternalRelationHydrationCardinality.SINGLE
          ? GeneratedHydratedTarget<TDescriptor, TPath> | null
          : GeneratedHydratedTarget<TDescriptor, TPath>[]
      : never;

// Turn one path string into the object fragment it contributes before all path
// fragments are merged into the final hydrated relation map.
type GeneratedHydrationForPath<TSourceModel, TPath extends string> =
    SplitPath<TPath> extends [infer THead extends string, ...infer TRest extends string[]]
        ? THead extends GeneratedRelationKeys<TSourceModel>
            ? {
                  [TKey in THead]: GeneratedHydratedValue<
                      GeneratedRelations<TSourceModel>[THead],
                      JoinPathSegments<TRest>
                  >;
              }
            : // oxlint-disable-next-line typescript/ban-types, typescript/no-empty-object-type
              {}
        : // oxlint-disable-next-line typescript/ban-types, typescript/no-empty-object-type
          {};

export type GeneratedHydratedRelationMap<TSourceModel, TPaths extends string | never> = ([TPaths] extends [never]
    ? Record<never, never>
    : UnionToIntersection<TPaths extends string ? GeneratedHydrationForPath<TSourceModel, TPaths> : never>) &
    Record<never, never>;

export type HasStrictRelationTyping<TSourceModel> = HasStrictModelKey<TSourceModel>;

// Reverse relation typing compares the literal model key carried by the target field against the source model key.
type ModelKeysMatch<TCandidate, TExpected> =
    TCandidate extends Model<z.ZodObject<z.ZodRawShape>, infer TCandidateKey>
        ? // The candidate relation target is a Tango model. Now check whether the expected source is also a model.
          TExpected extends Model<z.ZodObject<z.ZodRawShape>, infer TExpectedKey>
            ? // Both sides must keep literal keys, otherwise a plain string could accidentally match anything.
              IsLiteralString<TCandidateKey> extends true
                ? IsLiteralString<TExpectedKey> extends true
                    ? // Tuple wrapping avoids distributive conditional behavior and compares the keys as whole values.
                      [TCandidateKey] extends [TExpectedKey]
                        ? true
                        : false
                    : false
                : false
            : false
        : false;

// Keep this in sync with RelationDescriptorNormalizer.deriveNamingHint(...), which currently recognizes
// camelCase "Id" and snake_case "_id" suffixes but does not treat lowercase "id" as a relation suffix.
type FieldNamingHint<TKey extends string> = TKey extends `${infer TBase}Id`
    ? // Convert authorId -> author for relation names when the decorator did not configure name explicitly.
      TBase
    : TKey extends `${infer TBase}_id`
      ? // Convert author_id -> author for snake_case field names.
        TBase
      : // Otherwise the field key is already the best available relation-name hint.
        TKey;

// Prefer an explicitly configured forward relation name. Fall back to the field-name heuristic.
type RelationName<TKey extends string, TName> = TName extends string ? TName : FieldNamingHint<TKey>;
// Reverse relations cannot be inferred without an explicit relatedName, so missing names become never.
type RelatedName<TName> = TName extends string ? TName : never;

// Relation decorators brand their Zod field with type-only metadata. The next group extracts that metadata:
// relation target, configured forward name, configured reverse name, and relation kind.
type RelationTarget<TField> =
    TField extends RelationDecoratedSchema<
        z.ZodTypeAny,
        DecoratedFieldKind,
        infer TTarget,
        string | undefined,
        string | undefined
    >
        ? // infer TTarget captures the typed model target carried by direct refs, callbacks, or t.modelRef<TModel>(...).
          TTarget
        : never;

type RelationConfiguredName<TField> =
    TField extends RelationDecoratedSchema<z.ZodTypeAny, DecoratedFieldKind, AnyModel, infer TName, string | undefined>
        ? // infer TName captures config.name when the decorator call used a literal string.
          TName
        : undefined;

type RelationConfiguredRelatedName<TField> =
    TField extends RelationDecoratedSchema<
        z.ZodTypeAny,
        DecoratedFieldKind,
        AnyModel,
        string | undefined,
        infer TRelatedName
    >
        ? // infer TRelatedName captures config.relatedName when the decorator call used a literal string.
          TRelatedName
        : undefined;

type RelationKindOf<TField> =
    TField extends RelationDecoratedSchema<z.ZodTypeAny, infer TKind, AnyModel, string | undefined, string | undefined>
        ? // infer TKind tells us whether the field was branded by foreignKey, oneToOne, or manyToMany.
          TKind
        : never;

// Forward relations live on the source model's own schema. A foreign key and a one-to-one field are both
// single-valued from the source model's point of view, so both hydrate through selectRelated(...).
export type ForwardSingleRelations<TSourceModel> =
    HasStrictModelKey<TSourceModel> extends true
        ? // Strict source model: inspect its own schema and emit only fields that are forward single relations.
          {
              [TKey in keyof ModelShape<TSourceModel> as TKey extends string
                  ? // Non-relation fields have no decorator brand and therefore map to never.
                    [RelationKindOf<ModelShape<TSourceModel>[TKey]>] extends [never]
                      ? never
                      : // foreignKey and oneToOne are both single-valued when loaded from the source model.
                        RelationKindOf<ModelShape<TSourceModel>[TKey]> extends
                              | typeof InternalDecoratedFieldKind.FOREIGN_KEY
                              | typeof InternalDecoratedFieldKind.ONE_TO_ONE
                        ? // The relation must carry a typed model target; plain string refs cannot hydrate a typed result.
                          RelationTarget<ModelShape<TSourceModel>[TKey]> extends AnyModel
                            ? // The mapped-type key is the public relation name accepted by selectRelated(...).
                              RelationName<TKey, RelationConfiguredName<ModelShape<TSourceModel>[TKey]>>
                            : never
                        : never
                  : never]: {
                  kind: typeof InternalDecoratedFieldKind.FOREIGN_KEY;
                  target: RelationTarget<ModelShape<TSourceModel>[TKey]>;
              };
          }
        : // Weak source model: allow runtime strings but do not add precise hydrated result properties.
          Record<string, { kind: typeof InternalDecoratedFieldKind.FOREIGN_KEY; target: AnyModel }>;

// A reverse single relation is only visible when the caller supplies the target model generic. We inspect that
// target model for a one-to-one field pointing back to the source model and use its relatedName.
export type ReverseSingleRelations<TSourceModel, TTargetModel> =
    HasStrictModelKey<TSourceModel> extends true
        ? // Reverse typing needs both the current source model and the away/target model to keep literal keys.
          HasStrictModelKey<TTargetModel> extends true
            ? {
                  [TKey in keyof ModelShape<TTargetModel> as [RelationKindOf<ModelShape<TTargetModel>[TKey]>] extends [
                      never,
                  ]
                      ? // Ignore ordinary fields on the away model.
                        never
                      : // Only oneToOne creates a single-valued reverse relation.
                        RelationKindOf<
                              ModelShape<TTargetModel>[TKey]
                          > extends typeof InternalDecoratedFieldKind.ONE_TO_ONE
                        ? // The away model's oneToOne target must point back at the current source model.
                          ModelKeysMatch<RelationTarget<ModelShape<TTargetModel>[TKey]>, TSourceModel> extends true
                            ? // The reverse call-site key is the away field's configured relatedName.
                              RelatedName<RelationConfiguredRelatedName<ModelShape<TTargetModel>[TKey]>>
                            : never
                        : never]: {
                      kind: typeof InternalDecoratedFieldKind.ONE_TO_ONE;
                      target: TTargetModel;
                  };
              }
            : // A widened target model cannot prove reverse relation names.
              // oxlint-disable-next-line typescript/ban-types, typescript/no-empty-object-type
              {}
        : // Weak source model: allow runtime strings but do not add precise hydrated result properties.
          Record<string, { kind: typeof InternalDecoratedFieldKind.ONE_TO_ONE; target: AnyModel }>;

// A reverse collection relation follows the same target-model inspection path, but only foreign keys produce hasMany.
export type ReverseCollectionRelations<TSourceModel, TTargetModel> =
    HasStrictModelKey<TSourceModel> extends true
        ? // Reverse collection typing also needs both model keys to remain literal.
          HasStrictModelKey<TTargetModel> extends true
            ? {
                  [TKey in keyof ModelShape<TTargetModel> as [RelationKindOf<ModelShape<TTargetModel>[TKey]>] extends [
                      never,
                  ]
                      ? // Ignore ordinary fields on the away model.
                        never
                      : // A foreign key on the away model creates a hasMany collection from the source model.
                        RelationKindOf<
                              ModelShape<TTargetModel>[TKey]
                          > extends typeof InternalDecoratedFieldKind.FOREIGN_KEY
                        ? // The away model's foreign key must point back at the current source model.
                          ModelKeysMatch<RelationTarget<ModelShape<TTargetModel>[TKey]>, TSourceModel> extends true
                            ? // The reverse call-site key is the away field's configured relatedName.
                              RelatedName<RelationConfiguredRelatedName<ModelShape<TTargetModel>[TKey]>>
                            : never
                        : never]: {
                      kind: typeof InternalDecoratedFieldKind.FOREIGN_KEY;
                      target: TTargetModel;
                  };
              }
            : // A widened target model cannot prove reverse relation names.
              // oxlint-disable-next-line typescript/ban-types, typescript/no-empty-object-type
              {}
        : // Weak source model: allow runtime strings but do not add precise hydrated result properties.
          Record<string, { kind: typeof InternalDecoratedFieldKind.FOREIGN_KEY; target: AnyModel }>;

export type SelectRelatedRelations<TSourceModel, TTargetModel> = [TTargetModel] extends [undefined]
    ? // No target generic: selectRelated(...) can only use forward relations from the source schema.
      ForwardSingleRelations<TSourceModel>
    : // Target generic supplied: include reverse hasOne relations discovered on that target model.
      ForwardSingleRelations<TSourceModel> & ReverseSingleRelations<TSourceModel, TTargetModel>;

// prefetchRelated(...) only loads collection relations in this pass, so it only accepts reverse hasMany metadata.
export type PrefetchRelatedRelations<TSourceModel, TTargetModel> = ReverseCollectionRelations<
    TSourceModel,
    TTargetModel
>;

// QuerySet method parameters need a string union of accepted relation names.
export type RelationKeys<TRelations> = Extract<keyof TRelations, string>;

// Convert a selected relation-key union into the result object that fetch(...) exposes.
export type HydratedRelationMap<TRelations, TKeys extends string, TCardinality extends RelationHydrationCardinality> = {
    [TKey in TKeys]: TKey extends keyof TRelations
        ? // The relation map value carries the target model; infer that target so we can derive its row type.
          TRelations[TKey] extends { target: infer TTarget }
            ? // Single-valued relation hydration returns the target model or null when the join finds no row.
              TCardinality extends typeof InternalRelationHydrationCardinality.SINGLE
                ? ModelRow<TTarget> | null
                : // Collection relation hydration returns zero or more target model rows.
                  ModelRow<TTarget>[]
            : never
        : never;
};

export type MaybeHydratedRelationMap<
    TSourceModel,
    TRelations,
    TKeys extends string,
    TCardinality extends RelationHydrationCardinality,
> =
    HasStrictModelKey<TSourceModel> extends true
        ? // Strict source model: materialize the requested hydrated relation properties into the fetched result type.
          HydratedRelationMap<TRelations, TKeys, TCardinality>
        : // Weak source model: preserve runtime support, but avoid pretending we know the hydrated result shape.
          Record<never, never>;
