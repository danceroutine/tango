/**
 * Domain boundary barrel: centralizes this subdomain's public contract.
 *
 * Tango keeps both flat exports and namespaced subdomain barrels here so
 * callers can choose TS-native direct imports or Django-style drill-down
 * access through the bundled `model` namespace at the package root.
 */

export * as decorators from './decorators/index';
export * as meta from './meta/index';
export * as constraints from './constraints/index';
export * as registry from './registry/index';
export * as relations from './relations/index';

export type { ModelDefinition } from './ModelDefinition';
export { RelationBuilder } from './relations/index';
export { ImplicitManyToManyIdentifier } from './relations/ImplicitManyToManyIdentifier';
export { Model } from './Model';
export { registerModelAugmentor } from './ModelAugmentorRegistry';
export { Decorators, t } from './decorators/index';
export type {
    TangoDecorators,
    FieldDecoratorBuilder,
    DecoratedFieldKind,
    ModelRef,
    ModelRefTarget,
    RelationDecoratedSchema,
    TypedModelRef,
    ForeignKeyDecoratorConfig,
    OneToOneDecoratorConfig,
    ManyToManyDecoratorConfig,
} from './decorators/index';
export { createTypedModelRef, InternalDecoratedFieldKind, isTypedModelRef } from './decorators/index';
export { Meta, m } from './meta/index';
export type { ModelConstraint, ModelMetaFragment } from './meta/index';
export { Constraints, Indexes, c, i } from './constraints/index';
export type { ConstraintDefinition } from './constraints/index';
export {
    ModelRegistry,
    createSchemaModuleAliases,
    resolveSchemaModuleEntrypoint,
    GENERATED_RELATION_REGISTRY_DIRNAME,
    GENERATED_RELATION_REGISTRY_METADATA_FILENAME,
    GENERATED_RELATION_REGISTRY_METADATA_VERSION,
    GENERATED_RELATION_REGISTRY_TYPES_FILENAME,
    ResolvedRelationGraphArtifactFactory,
    type GeneratedRelationRegistryArtifact,
    type ResolvedRelationGraphSnapshot,
    type ResolvedRelationGraphSnapshotModel,
    type ResolvedRelationGraphSnapshotRelation,
} from './registry/index';
