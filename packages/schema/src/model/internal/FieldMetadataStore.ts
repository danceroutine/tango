import type { TangoFieldMeta, ZodTypeAny } from '../decorators/types';

const fieldMetadataStore = new WeakMap<ZodTypeAny, TangoFieldMeta>();

export function getFieldMetadata(schema: ZodTypeAny): TangoFieldMeta | undefined {
    return fieldMetadataStore.get(schema);
}

export function setFieldMetadata(schema: ZodTypeAny, meta: TangoFieldMeta): void {
    const existing = fieldMetadataStore.get(schema);
    fieldMetadataStore.set(schema, {
        ...existing,
        ...meta,
    });
}
