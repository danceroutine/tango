import type { CodegenFieldMeta, CodegenModel } from '../domain';

/**
 * Map Tango field metadata to the TypeScript type used in generated source.
 */
export function mapFieldTypeToTS(type: string): string {
    const typeMap: Record<string, string> = {
        string: 'string',
        number: 'number',
        boolean: 'boolean',
        date: 'Date',
        serial: 'number',
        int: 'number',
        bigint: 'number',
        text: 'string',
        bool: 'boolean',
        uuid: 'string',
        jsonb: 'unknown',
        timestamptz: 'Date',
    };

    return typeMap[type] || 'unknown';
}

/**
 * Normalize field metadata into a stable iterable shape for generators.
 */
export function normalizeFields(fields: CodegenModel['fields']): Array<[string, CodegenFieldMeta]> {
    if (Array.isArray(fields)) {
        return fields.map((field) => [
            field.name,
            {
                type: field.type,
                primaryKey: field.primaryKey,
                unique: field.unique,
                nullable: !field.notNull,
                default: field.default,
            },
        ]);
    }

    return Object.entries(fields);
}
