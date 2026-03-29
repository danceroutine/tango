import type { OpenAPIModel, SchemaObject } from '../../domain';
import { mapTypeToOpenAPI } from './mapTypeToOpenAPI';

/**
 * Derive an OpenAPI schema object from Tango model metadata.
 */
export function generateSchemaFromModel(model: OpenAPIModel): SchemaObject {
    const properties: Record<string, SchemaObject> = {};
    const required: string[] = [];

    for (const [name, meta] of Object.entries(model.fields)) {
        properties[name] = {
            type: mapTypeToOpenAPI(meta.type),
            description: meta.description,
        };

        if (!meta.nullable && meta.default === undefined && !meta.primaryKey) {
            required.push(name);
        }
    }

    return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
    };
}
