import type { ZodTypeAny } from './ZodTypeAny';
import type { ReferentialOptions } from './TangoFieldMeta';
import type { ModelRef } from './ModelRef';

/**
 * Config object for `t.foreignKey(...)`.
 *
 * The config object is the preferred second-argument form for relation
 * decorators. Omit `field` to keep Tango's default schema inference.
 */
export interface ForeignKeyDecoratorConfig<TField extends ZodTypeAny = ZodTypeAny> extends ReferentialOptions {
    field?: TField;
    name?: string;
    relatedName?: string;
}

/**
 * Config object for `t.oneToOne(...)`.
 *
 * The config object is the preferred second-argument form for relation
 * decorators. Omit `field` to keep Tango's default schema inference.
 */
export interface OneToOneDecoratorConfig<TField extends ZodTypeAny = ZodTypeAny> extends ReferentialOptions {
    field?: TField;
    name?: string;
    relatedName?: string;
}

/**
 * Config object for `t.manyToMany(...)`.
 *
 * The config object is the preferred second-argument form for relation
 * decorators. Omit `field` to keep Tango's default schema inference.
 */
export interface ManyToManyDecoratorConfig<TField extends ZodTypeAny = ZodTypeAny> {
    field?: TField;
    name?: string;
    relatedName?: never;
    through?: ModelRef;
    throughSourceFieldName?: string;
    throughTargetFieldName?: string;
}
