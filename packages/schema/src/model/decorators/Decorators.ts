import { z } from 'zod';
import { setFieldMetadata } from '../internal/FieldMetadataStore';
import type { ModelRef, ReferentialOptions, TangoFieldMeta, ZodTypeAny } from './types';

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

function defaultValue<T extends ZodTypeAny>(schema: T, value: string | { now: true } | null): T {
    return decorate(schema, { default: value });
}

function dbDefault<T extends ZodTypeAny>(schema: T, value: string): T {
    return decorate(schema, { dbDefault: value });
}

function dbColumn<T extends ZodTypeAny>(schema: T, name: string): T {
    return decorate(schema, { dbColumn: name });
}

function dbIndex<T extends ZodTypeAny>(schema: T): T {
    return decorate(schema, { dbIndex: true });
}

function choices<T extends ZodTypeAny>(schema: T, values: readonly unknown[]): T {
    return decorate(schema, { choices: values });
}

function validators<T extends ZodTypeAny>(schema: T, ...values: readonly ((value: unknown) => unknown)[]): T {
    return decorate(schema, { validators: values });
}

function helpText<T extends ZodTypeAny>(schema: T, text: string): T {
    return decorate(schema, { helpText: text });
}

function errorMessages<T extends ZodTypeAny>(schema: T, map: Record<string, string>): T {
    return decorate(schema, { errorMessages: map });
}

function foreignKey<T extends ZodTypeAny>(target: ModelRef, schema: T, options?: ReferentialOptions): T;
function foreignKey(target: ModelRef, options?: ReferentialOptions): z.ZodNumber;
function foreignKey<T extends ZodTypeAny>(
    target: ModelRef,
    schemaOrOptions?: T | ReferentialOptions,
    maybeOptions?: ReferentialOptions
): T | z.ZodNumber {
    if (isZodType(schemaOrOptions)) {
        return decorate(schemaOrOptions, {
            relationKind: 'foreignKey',
            references: {
                target,
                options: maybeOptions,
            },
        });
    }

    const defaultSchema = z.number().int();
    return decorate(defaultSchema, {
        relationKind: 'foreignKey',
        references: {
            target,
            options: schemaOrOptions,
        },
        notNull: true,
    });
}

function oneToOne<T extends ZodTypeAny>(target: ModelRef, schema: T, options?: ReferentialOptions): T;
function oneToOne(target: ModelRef, options?: ReferentialOptions): z.ZodNumber;
function oneToOne<T extends ZodTypeAny>(
    target: ModelRef,
    schemaOrOptions?: T | ReferentialOptions,
    maybeOptions?: ReferentialOptions
): T | z.ZodNumber {
    if (isZodType(schemaOrOptions)) {
        return decorate(schemaOrOptions, {
            relationKind: 'oneToOne',
            unique: true,
            references: {
                target,
                options: maybeOptions,
            },
        });
    }

    const defaultSchema = z.number().int();
    return decorate(defaultSchema, {
        relationKind: 'oneToOne',
        unique: true,
        references: {
            target,
            options: schemaOrOptions,
        },
        notNull: true,
    });
}

function manyToMany<T extends ZodTypeAny>(target: ModelRef, schema: T): T;
function manyToMany(target: ModelRef): z.ZodArray<z.ZodNumber>;
function manyToMany<T extends ZodTypeAny>(target: ModelRef, schema?: T): T | z.ZodArray<z.ZodNumber> {
    if (schema) {
        return decorate(schema, {
            relationKind: 'manyToMany',
            references: {
                target,
            },
        });
    }

    const defaultSchema = z.array(z.number().int());
    return decorate(defaultSchema, {
        relationKind: 'manyToMany',
        references: {
            target,
        },
    });
}

type UnaryFieldDecorator = {
    <T extends ZodTypeAny>(schema: T): T;
    <T extends ZodTypeAny>(): (input: T) => T;
};

type RelationshipDecorator = {
    <T extends ZodTypeAny>(target: ModelRef, schema: T, options?: ReferentialOptions): T;
    (target: ModelRef, options?: ReferentialOptions): z.ZodNumber;
};

type ManyToManyDecorator = {
    <T extends ZodTypeAny>(target: ModelRef, schema: T): T;
    (target: ModelRef): z.ZodArray<z.ZodNumber>;
};

export interface TangoDecorators {
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
    oneToOne: RelationshipDecorator;
    manyToMany: ManyToManyDecorator;
}

export const Decorators: TangoDecorators = {
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
    oneToOne: oneToOne as RelationshipDecorator,
    manyToMany: manyToMany as ManyToManyDecorator,
};
