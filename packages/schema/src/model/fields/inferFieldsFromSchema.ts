import { z } from 'zod';
import type { Field, FieldType } from '../../domain/index';
import { InternalFieldType } from '../../domain/internal/InternalFieldType';
import { getFieldMetadata } from './FieldMetadataStore';
import type { ZodTypeAny } from '../decorators/domain/ZodTypeAny';
import type { ModelRef } from '../decorators/domain/ModelRef';
import type { TangoFieldMeta } from '../decorators/domain/TangoFieldMeta';
import { INTERNAL_DECORATED_FIELD_KIND } from '../decorators/domain/DecoratedFieldKind';
import { ModelRegistry } from '../registry/ModelRegistry';
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
} from '../../domain/internal/zod/index';

export type InferFieldsOptions = {
    registry?: ModelRegistry;
    resolveReferenceTarget?: (target: ModelRef) => { table: string; pk: string };
};

/**
 * Infer one storage field from a Zod schema member plus any Tango decorator metadata.
 *
 * The registry and optional target resolver are used only when the field carries
 * reference metadata that must be translated into concrete table/primary-key names.
 */
function inferField(
    name: string,
    zodType: z.ZodType,
    meta: TangoFieldMeta | undefined,
    registry: ModelRegistry,
    resolveReferenceTarget?: (target: ModelRef) => { table: string; pk: string }
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

    // Many-to-many declarations stay on the relation side of the seam. They do
    // not correspond to a stored column on the current table.
    if (meta.relationKind === INTERNAL_DECORATED_FIELD_KIND.MANY_TO_MANY) {
        return null;
    }

    if (meta.references) {
        const targetMetadata = resolveReferenceTarget
            ? resolveReferenceTarget(meta.references.target)
            : resolveReferenceTargetFromRegistry(meta.references.target, registry, meta.references.options?.column);

        field.references = {
            table: targetMetadata.table,
            column: meta.references.options?.column ?? targetMetadata.pk,
            onDelete: meta.references.options?.onDelete,
            onUpdate: meta.references.options?.onUpdate,
        };
    }

    return field;
}

function resolveReferenceTargetFromRegistry(
    target: ModelRef,
    registry: ModelRegistry,
    explicitColumn?: string
): { table: string; pk: string } {
    const targetModel = registry.resolveRef(target);
    const primaryKey =
        explicitColumn ?? targetModel.metadata.fields.find((candidate) => candidate.primaryKey)?.name ?? 'id';

    return {
        table: targetModel.metadata.table,
        pk: primaryKey,
    };
}

/**
 * Infer Tango field metadata from a Zod object schema and any attached field decorators.
 */
export function inferFieldsFromSchema(schema: z.ZodObject<z.ZodRawShape>, options?: InferFieldsOptions): Field[] {
    const registry = options?.registry ?? ModelRegistry.global();
    const shape = schema.shape;
    const fields: Field[] = [];

    for (const [name, zodType] of Object.entries(shape)) {
        const field = inferField(
            name,
            zodType as z.ZodType,
            getFieldMetadata(zodType as ZodTypeAny),
            registry,
            options?.resolveReferenceTarget
        );
        if (field) {
            fields.push(field);
        }
    }

    return fields;
}
