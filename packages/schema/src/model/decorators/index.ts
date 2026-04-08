/**
 * Domain boundary barrel: centralizes this subdomain's public contract.
 */
export { Decorators, Decorators as t } from './Decorators';
export type { FieldDecoratorBuilder, TangoDecorators } from './Decorators';
export type { ModelRef, ModelRefTarget, TypedModelRef } from './domain/ModelRef';
export { createTypedModelRef, isTypedModelRef } from './domain/ModelRef';
export type { RelationDecoratedSchema } from './domain/RelationDecoratedSchema';
export { InternalDecoratedFieldKind } from './domain/DecoratedFieldKind';
export type { DecoratedFieldKind } from './domain/DecoratedFieldKind';
export type {
    ForeignKeyDecoratorConfig,
    OneToOneDecoratorConfig,
    ManyToManyDecoratorConfig,
} from './domain/RelationDecoratorConfig';
export type { ReferentialOptions, TangoFieldMeta } from './domain/TangoFieldMeta';
export type { ZodTypeAny } from './domain/ZodTypeAny';
