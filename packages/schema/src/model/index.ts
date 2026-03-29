/**
 * Domain boundary barrel: centralizes this subdomain's public contract.
 */

export type { ModelDefinition } from './ModelDefinition';
export { RelationBuilder } from './RelationBuilder';
export { Model } from './Model';
export { registerModelAugmentor } from './ModelAugmentorRegistry';
export { Decorators, t } from './decorators/index';
export type { TangoDecorators } from './decorators/index';
export { Meta, m } from './meta/index';
export type { ModelConstraint, ModelMetaFragment } from './meta/index';
export { Constraints, Indexes, c, i } from './constraints/index';
export type { ConstraintDefinition } from './constraints/index';
export { ModelRegistry } from './registry/ModelRegistry';
