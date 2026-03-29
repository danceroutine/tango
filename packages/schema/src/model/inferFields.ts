import { z } from 'zod';
import type { Field, FieldType } from '../domain/index';
import { InternalFieldType } from '../domain/internal/InternalFieldType';
import { getFieldMetadata } from './internal/FieldMetadataStore';
import type { TangoFieldMeta, ZodTypeAny } from './decorators/types';
import { ModelRegistry } from './registry/ModelRegistry';
import {
    isDate,
    isZodArray,
    isZodBoolean,
    isZodDate,
    isZodDefault,
    isZodNullable,
    isZodNumber,
    isZodObject,
    isZodOptional,
    isZodString,
} from '../domain/internal/zod/index';

export type InferFieldsOptions = {
    registry?: ModelRegistry;
};

function inferField(
    name: string,
    zodType: z.ZodType,
    meta: TangoFieldMeta | undefined,
    registry: ModelRegistry
): Field | null {
    let type: FieldType;
    let notNull = true;
    let defaultValue: Field['default'] = undefined;

    let unwrapped: z.ZodType = zodType;

    if (isZodOptional(unwrapped)) {
        notNull = false;
        unwrapped = unwrapped.unwrap() as z.ZodType;
    }

    if (isZodNullable(unwrapped)) {
        notNull = false;
        unwrapped = unwrapped.unwrap() as z.ZodType;
    }

    if (isZodDefault(unwrapped)) {
        const def = unwrapped._zod.def.defaultValue;
        if (isDate(def)) {
            defaultValue = { now: true };
        } else if (typeof def === 'string' || typeof def === 'number') {
            defaultValue = String(def);
        }
        unwrapped = unwrapped.removeDefault() as z.ZodType;
    }

    if (isZodString(unwrapped)) {
        type = InternalFieldType.TEXT;
    } else if (isZodNumber(unwrapped)) {
        const checks = unwrapped._zod.def.checks ?? [];
        const isInt = checks.some((c) => 'format' in c._zod.def && c._zod.def.format === 'safeint');
        type = isInt ? InternalFieldType.INT : InternalFieldType.BIGINT;
    } else if (isZodBoolean(unwrapped)) {
        type = InternalFieldType.BOOL;
    } else if (isZodDate(unwrapped)) {
        type = InternalFieldType.TIMESTAMPTZ;
    } else if (isZodObject(unwrapped) || isZodArray(unwrapped)) {
        type = InternalFieldType.JSONB;
    } else {
        return null;
    }

    const field: Field = {
        name,
        type,
        notNull,
        default: defaultValue,
    };

    if (!meta) {
        return field;
    }

    if (meta.dbColumn) {
        field.name = meta.dbColumn;
    }

    if (typeof meta.notNull === 'boolean') {
        field.notNull = meta.notNull;
    }

    if (meta.default !== undefined) {
        field.default = meta.default;
    }

    if (meta.primaryKey) {
        field.primaryKey = true;
    }

    if (meta.unique) {
        field.unique = true;
    }

    if (meta.references && meta.relationKind !== 'manyToMany') {
        const targetModel = registry.resolveRef(meta.references.target);
        const referencedColumn =
            meta.references.options?.column ??
            targetModel.metadata.fields.find((candidate) => candidate.primaryKey)?.name ??
            'id';

        field.references = {
            table: targetModel.metadata.table,
            column: referencedColumn,
            onDelete: meta.references.options?.onDelete,
            onUpdate: meta.references.options?.onUpdate,
        };
    }

    return field;
}

/**
 * Infer Tango field metadata from a Zod object schema and any attached field decorators.
 */
export function inferFieldsFromSchema(schema: z.ZodObject<z.ZodRawShape>, options?: InferFieldsOptions): Field[] {
    const registry = options?.registry ?? ModelRegistry.global();
    const shape = schema.shape;
    const fields: Field[] = [];

    for (const [name, zodType] of Object.entries(shape)) {
        const field = inferField(name, zodType as z.ZodType, getFieldMetadata(zodType as ZodTypeAny), registry);
        if (field) {
            fields.push(field);
        }
    }

    return fields;
}
