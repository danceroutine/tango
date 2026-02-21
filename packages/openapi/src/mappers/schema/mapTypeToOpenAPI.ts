/**
 * Map Tango field types to OpenAPI scalar/object type names.
 */
export function mapTypeToOpenAPI(type: string): string {
    const typeMap: Record<string, string> = {
        string: 'string',
        number: 'number',
        boolean: 'boolean',
        date: 'string',
        serial: 'integer',
        int: 'integer',
        bigint: 'integer',
        text: 'string',
        bool: 'boolean',
        uuid: 'string',
        jsonb: 'object',
        timestamptz: 'string',
    };

    return typeMap[type] || 'string';
}
