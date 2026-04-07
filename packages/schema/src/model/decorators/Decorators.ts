import { getLogger } from '@danceroutine/tango-core';
import { z } from 'zod';
import { setFieldMetadata } from '../fields/FieldMetadataStore';
import type { ZodTypeAny } from './domain/ZodTypeAny';
import { createTypedModelRef, type ModelRef, type ModelRefTarget, type TypedModelRef } from './domain/ModelRef';
import type { ReferentialOptions, TangoFieldMeta } from './domain/TangoFieldMeta';
import type { Model, ModelKeyOf } from '../../domain';
import type {
    ForeignKeyDecoratorConfig,
    ManyToManyDecoratorConfig,
    OneToOneDecoratorConfig,
} from './domain/RelationDecoratorConfig';
import type { RelationDecoratedSchema } from './domain/RelationDecoratedSchema';
import { InternalDecoratedFieldKind } from './domain/DecoratedFieldKind';
import type { DecoratedFieldKind } from './domain/DecoratedFieldKind';

function isZodType(value: unknown): value is ZodTypeAny {
    return (
        !!value &&
        typeof value === 'object' &&
        'safeParse' in value &&
        typeof (value as { safeParse?: unknown }).safeParse === 'function'
    );
}

function decorate<T extends ZodTypeAny>(schema: T, meta: TangoFieldMeta): T {
    setFieldMetadata(schema, meta);
    return schema;
}

const warnedDecoratorKinds = new Set<DecoratedFieldKind>();

function warnDeprecatedSchemaOverload(kind: DecoratedFieldKind, replacement: string): void {
    if (warnedDecoratorKinds.has(kind)) {
        return;
    }

    warnedDecoratorKinds.add(kind);
    getLogger('tango.schema.decorators').warn(
        `Deprecated positional schema overload used for t.${kind}(...). Prefer ${replacement} instead.`
    );
}

function maybeDecorator<T extends ZodTypeAny>(
    schemaOrUndefined: T | undefined,
    meta: TangoFieldMeta
): T | ((schema: T) => T) {
    if (schemaOrUndefined) {
        return decorate(schemaOrUndefined, meta);
    }

    return (schema: T) => decorate(schema, meta);
}

function primaryKey<T extends ZodTypeAny>(schema: T): T;
function primaryKey<T extends ZodTypeAny>(): (input: T) => T;
function primaryKey<T extends ZodTypeAny>(schema?: T): T | ((input: T) => T) {
    return maybeDecorator(schema, { primaryKey: true, notNull: true });
}

function unique<T extends ZodTypeAny>(schema: T): T;
function unique<T extends ZodTypeAny>(): (input: T) => T;
function unique<T extends ZodTypeAny>(schema?: T): T | ((input: T) => T) {
    return maybeDecorator(schema, { unique: true });
}

function nullValue<T extends ZodTypeAny>(schema: T): T;
function nullValue<T extends ZodTypeAny>(): (input: T) => T;
function nullValue<T extends ZodTypeAny>(schema?: T): T | ((input: T) => T) {
    return maybeDecorator(schema, { notNull: false });
}

function notNull<T extends ZodTypeAny>(schema: T): T;
function notNull<T extends ZodTypeAny>(): (input: T) => T;
function notNull<T extends ZodTypeAny>(schema?: T): T | ((input: T) => T) {
    return maybeDecorator(schema, { notNull: true });
}

function defaultValue<T extends ZodTypeAny>(schema: T, value: string | { now: true } | null): T;
function defaultValue<T extends ZodTypeAny>(schema: T, value: string | { now: true } | null): T {
    return decorate(schema, { default: value });
}

function dbDefault<T extends ZodTypeAny>(schema: T, value: string): T;
function dbDefault<T extends ZodTypeAny>(schema: T, value: string): T {
    return decorate(schema, { dbDefault: value });
}

function dbColumn<T extends ZodTypeAny>(schema: T, name: string): T;
function dbColumn<T extends ZodTypeAny>(schema: T, name: string): T {
    return decorate(schema, { dbColumn: name });
}

function dbIndex<T extends ZodTypeAny>(schema: T): T {
    return decorate(schema, { dbIndex: true });
}

function choices<T extends ZodTypeAny>(schema: T, values: readonly unknown[]): T;
function choices<T extends ZodTypeAny>(schema: T, values: readonly unknown[]): T {
    return decorate(schema, { choices: values });
}

function validators<T extends ZodTypeAny>(schema: T, ...values: readonly ((value: unknown) => unknown)[]): T;
function validators<T extends ZodTypeAny>(schema: T, ...values: readonly ((value: unknown) => unknown)[]): T {
    return decorate(schema, { validators: values });
}

function helpText<T extends ZodTypeAny>(schema: T, text: string): T;
function helpText<T extends ZodTypeAny>(schema: T, text: string): T {
    return decorate(schema, { helpText: text });
}

function errorMessages<T extends ZodTypeAny>(schema: T, map: Record<string, string>): T;
function errorMessages<T extends ZodTypeAny>(schema: T, map: Record<string, string>): T {
    return decorate(schema, { errorMessages: map });
}

export interface FieldDecoratorBuilder<TField extends ZodTypeAny> {
    defaultValue(value: string | { now: true } | null): FieldDecoratorBuilder<TField>;
    dbDefault(value: string): FieldDecoratorBuilder<TField>;
    dbColumn(name: string): FieldDecoratorBuilder<TField>;
    dbIndex(): FieldDecoratorBuilder<TField>;
    choices(values: readonly unknown[]): FieldDecoratorBuilder<TField>;
    validators(...values: readonly ((value: unknown) => unknown)[]): FieldDecoratorBuilder<TField>;
    helpText(text: string): FieldDecoratorBuilder<TField>;
    errorMessages(map: Record<string, string>): FieldDecoratorBuilder<TField>;
    build(): TField;
}

class FieldDecoratorBuilderImpl<TField extends ZodTypeAny> implements FieldDecoratorBuilder<TField> {
    constructor(private readonly schema: TField) {}

    defaultValue(value: string | { now: true } | null): FieldDecoratorBuilder<TField> {
        decorate(this.schema, { default: value });
        return this;
    }

    dbDefault(value: string): FieldDecoratorBuilder<TField> {
        decorate(this.schema, { dbDefault: value });
        return this;
    }

    dbColumn(name: string): FieldDecoratorBuilder<TField> {
        decorate(this.schema, { dbColumn: name });
        return this;
    }

    dbIndex(): FieldDecoratorBuilder<TField> {
        decorate(this.schema, { dbIndex: true });
        return this;
    }

    choices(values: readonly unknown[]): FieldDecoratorBuilder<TField> {
        decorate(this.schema, { choices: values });
        return this;
    }

    validators(...values: readonly ((value: unknown) => unknown)[]): FieldDecoratorBuilder<TField> {
        decorate(this.schema, { validators: values });
        return this;
    }

    helpText(text: string): FieldDecoratorBuilder<TField> {
        decorate(this.schema, { helpText: text });
        return this;
    }

    errorMessages(map: Record<string, string>): FieldDecoratorBuilder<TField> {
        decorate(this.schema, { errorMessages: map });
        return this;
    }

    build(): TField {
        return this.schema;
    }
}

function field<T extends ZodTypeAny>(schema: T): FieldDecoratorBuilder<T> {
    return new FieldDecoratorBuilderImpl(schema);
}

function applyRelationMetadata<T extends ZodTypeAny>(
    schema: T,
    meta: TangoFieldMeta,
    config?: { name?: string; relatedName?: string }
): T {
    return decorate(schema, {
        ...meta,
        forwardName: config?.name,
        reverseName: config?.relatedName,
    });
}

function toReferentialOptions(config?: ReferentialOptions): ReferentialOptions | undefined {
    if (!config) {
        return undefined;
    }

    if (config.column === undefined && config.onDelete === undefined && config.onUpdate === undefined) {
        return undefined;
    }

    return {
        column: config.column,
        onDelete: config.onDelete,
        onUpdate: config.onUpdate,
    };
}

type ConfigName<TConfig> = TConfig extends { name: infer TName extends string } ? TName : undefined;
type ConfigRelatedName<TConfig> = TConfig extends { relatedName: infer TRelatedName extends string }
    ? TRelatedName
    : undefined;

function modelRef<TModel extends Model>(key: ModelKeyOf<TModel>): TypedModelRef<TModel> {
    return createTypedModelRef<TModel>(key);
}

function foreignKey<
    TRef extends ModelRef,
    T extends ZodTypeAny,
    const TConfig extends ForeignKeyDecoratorConfig<T> & { field: T },
>(
    target: TRef,
    config: TConfig
): RelationDecoratedSchema<T, 'foreignKey', ModelRefTarget<TRef>, ConfigName<TConfig>, ConfigRelatedName<TConfig>>;
function foreignKey<TRef extends ModelRef, const TConfig extends ForeignKeyDecoratorConfig<z.ZodNumber> | undefined>(
    target: TRef,
    config?: TConfig
): RelationDecoratedSchema<
    z.ZodNumber,
    'foreignKey',
    ModelRefTarget<TRef>,
    ConfigName<TConfig>,
    ConfigRelatedName<TConfig>
>;
/**
 * @deprecated Use `t.foreignKey(target, { field: schema, ...options })` instead.
 */
function foreignKey<T extends ZodTypeAny>(
    target: ModelRef,
    schema: T,
    options?: ReferentialOptions
): RelationDecoratedSchema<T, 'foreignKey'>;
function foreignKey<T extends ZodTypeAny>(
    target: ModelRef,
    schemaOrOptions?: T | ForeignKeyDecoratorConfig<T>,
    maybeOptions?: ReferentialOptions
): RelationDecoratedSchema<T, 'foreignKey'> | z.ZodNumber {
    if (isZodType(schemaOrOptions)) {
        warnDeprecatedSchemaOverload(
            InternalDecoratedFieldKind.FOREIGN_KEY,
            't.foreignKey(target, { field: schema, ...options })'
        );
        return applyRelationMetadata(schemaOrOptions, {
            relationKind: InternalDecoratedFieldKind.FOREIGN_KEY,
            references: {
                target,
                options: maybeOptions,
            },
        }) as RelationDecoratedSchema<T, 'foreignKey'>;
    }

    const config = schemaOrOptions;
    const schema = config?.field ?? z.number().int();
    return applyRelationMetadata(
        schema,
        {
            relationKind: InternalDecoratedFieldKind.FOREIGN_KEY,
            references: {
                target,
                options: toReferentialOptions(config),
            },
            notNull: config?.field ? undefined : true,
        },
        config
    ) as RelationDecoratedSchema<T, 'foreignKey'> | z.ZodNumber;
}

function oneToOne<
    TRef extends ModelRef,
    T extends ZodTypeAny,
    const TConfig extends OneToOneDecoratorConfig<T> & { field: T },
>(
    target: TRef,
    config: TConfig
): RelationDecoratedSchema<T, 'oneToOne', ModelRefTarget<TRef>, ConfigName<TConfig>, ConfigRelatedName<TConfig>>;
function oneToOne<TRef extends ModelRef, const TConfig extends OneToOneDecoratorConfig<z.ZodNumber> | undefined>(
    target: TRef,
    config?: TConfig
): RelationDecoratedSchema<
    z.ZodNumber,
    'oneToOne',
    ModelRefTarget<TRef>,
    ConfigName<TConfig>,
    ConfigRelatedName<TConfig>
>;
/**
 * @deprecated Use `t.oneToOne(target, { field: schema, ...options })` instead.
 */
function oneToOne<T extends ZodTypeAny>(
    target: ModelRef,
    schema: T,
    options?: ReferentialOptions
): RelationDecoratedSchema<T, 'oneToOne'>;
function oneToOne<T extends ZodTypeAny>(
    target: ModelRef,
    schemaOrOptions?: T | OneToOneDecoratorConfig<T>,
    maybeOptions?: ReferentialOptions
): RelationDecoratedSchema<T, 'oneToOne'> | z.ZodNumber {
    if (isZodType(schemaOrOptions)) {
        warnDeprecatedSchemaOverload(
            InternalDecoratedFieldKind.ONE_TO_ONE,
            't.oneToOne(target, { field: schema, ...options })'
        );
        return applyRelationMetadata(schemaOrOptions, {
            relationKind: InternalDecoratedFieldKind.ONE_TO_ONE,
            unique: true,
            references: {
                target,
                options: maybeOptions,
            },
        }) as RelationDecoratedSchema<T, 'oneToOne'>;
    }

    const config = schemaOrOptions;
    const schema = config?.field ?? z.number().int();
    return applyRelationMetadata(
        schema,
        {
            relationKind: InternalDecoratedFieldKind.ONE_TO_ONE,
            unique: true,
            references: {
                target,
                options: toReferentialOptions(config),
            },
            notNull: config?.field ? undefined : true,
        },
        config
    ) as RelationDecoratedSchema<T, 'oneToOne'> | z.ZodNumber;
}

function manyToMany<
    TRef extends ModelRef,
    T extends ZodTypeAny,
    const TConfig extends ManyToManyDecoratorConfig<T> & { field: T },
>(
    target: TRef,
    config: TConfig
): RelationDecoratedSchema<T, 'manyToMany', ModelRefTarget<TRef>, ConfigName<TConfig>, undefined>;
function manyToMany<
    TRef extends ModelRef,
    const TConfig extends ManyToManyDecoratorConfig<z.ZodArray<z.ZodNumber>> | undefined,
>(
    target: TRef,
    config?: TConfig
): RelationDecoratedSchema<z.ZodArray<z.ZodNumber>, 'manyToMany', ModelRefTarget<TRef>, ConfigName<TConfig>, undefined>;
/**
 * @deprecated Use `t.manyToMany(target, { field: schema, name })` instead.
 */
function manyToMany<T extends ZodTypeAny>(target: ModelRef, schema: T): RelationDecoratedSchema<T, 'manyToMany'>;
function manyToMany<T extends ZodTypeAny>(
    target: ModelRef,
    schemaOrConfig?: T | ManyToManyDecoratorConfig<T>
): RelationDecoratedSchema<T, 'manyToMany'> | z.ZodArray<z.ZodNumber> {
    if (isZodType(schemaOrConfig)) {
        warnDeprecatedSchemaOverload(
            InternalDecoratedFieldKind.MANY_TO_MANY,
            't.manyToMany(target, { field: schema, name })'
        );
        return applyRelationMetadata(schemaOrConfig, {
            relationKind: InternalDecoratedFieldKind.MANY_TO_MANY,
            references: {
                target,
            },
        }) as RelationDecoratedSchema<T, 'manyToMany'>;
    }

    if (schemaOrConfig?.relatedName !== undefined) {
        throw new Error('t.manyToMany(...) does not support relatedName yet.');
    }

    const config = schemaOrConfig;
    const schema = config?.field ?? z.array(z.number().int());
    return applyRelationMetadata(
        schema,
        {
            relationKind: InternalDecoratedFieldKind.MANY_TO_MANY,
            references: {
                target,
            },
        },
        config
    ) as RelationDecoratedSchema<T, 'manyToMany'> | z.ZodArray<z.ZodNumber>;
}

type UnaryFieldDecorator = {
    <T extends ZodTypeAny>(schema: T): T;
    <T extends ZodTypeAny>(): (input: T) => T;
};

type RelationshipDecorator = {
    <TRef extends ModelRef, T extends ZodTypeAny, const TConfig extends ForeignKeyDecoratorConfig<T> & { field: T }>(
        target: TRef,
        config: TConfig
    ): RelationDecoratedSchema<T, 'foreignKey', ModelRefTarget<TRef>, ConfigName<TConfig>, ConfigRelatedName<TConfig>>;
    <TRef extends ModelRef, const TConfig extends ForeignKeyDecoratorConfig<z.ZodNumber> | undefined>(
        target: TRef,
        config?: TConfig
    ): RelationDecoratedSchema<
        z.ZodNumber,
        'foreignKey',
        ModelRefTarget<TRef>,
        ConfigName<TConfig>,
        ConfigRelatedName<TConfig>
    >;
    /**
     * @deprecated Use `t.foreignKey(target, { field: schema, ...options })` instead.
     */
    <T extends ZodTypeAny>(
        target: ModelRef,
        schema: T,
        options?: ReferentialOptions
    ): RelationDecoratedSchema<T, 'foreignKey'>;
};

type OneToOneRelationshipDecorator = {
    <TRef extends ModelRef, T extends ZodTypeAny, const TConfig extends OneToOneDecoratorConfig<T> & { field: T }>(
        target: TRef,
        config: TConfig
    ): RelationDecoratedSchema<T, 'oneToOne', ModelRefTarget<TRef>, ConfigName<TConfig>, ConfigRelatedName<TConfig>>;
    <TRef extends ModelRef, const TConfig extends OneToOneDecoratorConfig<z.ZodNumber> | undefined>(
        target: TRef,
        config?: TConfig
    ): RelationDecoratedSchema<
        z.ZodNumber,
        'oneToOne',
        ModelRefTarget<TRef>,
        ConfigName<TConfig>,
        ConfigRelatedName<TConfig>
    >;
    /**
     * @deprecated Use `t.oneToOne(target, { field: schema, ...options })` instead.
     */
    <T extends ZodTypeAny>(
        target: ModelRef,
        schema: T,
        options?: ReferentialOptions
    ): RelationDecoratedSchema<T, 'oneToOne'>;
};

type ManyToManyDecorator = {
    <TRef extends ModelRef, T extends ZodTypeAny, const TConfig extends ManyToManyDecoratorConfig<T> & { field: T }>(
        target: TRef,
        config: TConfig
    ): RelationDecoratedSchema<T, 'manyToMany', ModelRefTarget<TRef>, ConfigName<TConfig>, undefined>;
    <TRef extends ModelRef, const TConfig extends ManyToManyDecoratorConfig<z.ZodArray<z.ZodNumber>> | undefined>(
        target: TRef,
        config?: TConfig
    ): RelationDecoratedSchema<
        z.ZodArray<z.ZodNumber>,
        'manyToMany',
        ModelRefTarget<TRef>,
        ConfigName<TConfig>,
        undefined
    >;
    /**
     * @deprecated Use `t.manyToMany(target, { field: schema, name })` instead.
     */
    <T extends ZodTypeAny>(target: ModelRef, schema: T): RelationDecoratedSchema<T, 'manyToMany'>;
};

export interface TangoDecorators {
    field: <T extends ZodTypeAny>(schema: T) => FieldDecoratorBuilder<T>;
    modelRef: <TModel extends Model>(key: ModelKeyOf<TModel>) => TypedModelRef<TModel>;
    primaryKey: UnaryFieldDecorator;
    unique: UnaryFieldDecorator;
    null: UnaryFieldDecorator;
    notNull: UnaryFieldDecorator;
    default: <T extends ZodTypeAny>(schema: T, value: string | { now: true } | null) => T;
    dbDefault: <T extends ZodTypeAny>(schema: T, value: string) => T;
    dbColumn: <T extends ZodTypeAny>(schema: T, name: string) => T;
    dbIndex: <T extends ZodTypeAny>(schema: T) => T;
    choices: <T extends ZodTypeAny>(schema: T, values: readonly unknown[]) => T;
    validators: <T extends ZodTypeAny>(schema: T, ...values: readonly ((value: unknown) => unknown)[]) => T;
    helpText: <T extends ZodTypeAny>(schema: T, text: string) => T;
    errorMessages: <T extends ZodTypeAny>(schema: T, map: Record<string, string>) => T;
    foreignKey: RelationshipDecorator;
    oneToOne: OneToOneRelationshipDecorator;
    manyToMany: ManyToManyDecorator;
}

export const Decorators: TangoDecorators = {
    field,
    modelRef,
    primaryKey: primaryKey as UnaryFieldDecorator,
    unique: unique as UnaryFieldDecorator,
    null: nullValue as UnaryFieldDecorator,
    notNull: notNull as UnaryFieldDecorator,
    default: defaultValue,
    dbDefault: dbDefault,
    dbColumn: dbColumn,
    dbIndex: dbIndex,
    choices: choices,
    validators: validators,
    helpText: helpText,
    errorMessages: errorMessages,
    foreignKey: foreignKey as RelationshipDecorator,
    oneToOne: oneToOne as OneToOneRelationshipDecorator,
    manyToMany: manyToMany as ManyToManyDecorator,
};
