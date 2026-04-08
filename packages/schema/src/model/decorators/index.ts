/**
 * Domain boundary barrel: centralizes this subdomain's public contract.
 */
export { Decorators, Decorators as t } from './Decorators';
export type { FieldDecoratorBuilder, TangoDecorators } from './Decorators';
export type { ModelRef } from './domain/ModelRef';
export type {
    ForeignKeyDecoratorConfig,
    OneToOneDecoratorConfig,
    ManyToManyDecoratorConfig,
} from './domain/RelationDecoratorConfig';
export type { ReferentialOptions, TangoFieldMeta } from './domain/TangoFieldMeta';
export type { ZodTypeAny } from './domain/ZodTypeAny';
