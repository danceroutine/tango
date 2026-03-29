import { z } from 'zod';
import type { SchemaObject } from '../../domain';

function stripDialect(schema: unknown): unknown {
    if (Array.isArray(schema)) {
        return schema.map((entry) => stripDialect(entry));
    }

    if (schema && typeof schema === 'object') {
        const input = schema as Record<string, unknown>;
        return Object.fromEntries(
            Object.entries(input)
                .filter(([key]) => key !== '$schema')
                .map(([key, value]) => [key, stripDialect(value)])
        );
    }

    return schema;
}

/**
 * Derive an OpenAPI-compatible schema object from a Zod schema.
 */
export function generateSchemaFromZod(schema: z.ZodType): SchemaObject {
    return stripDialect(z.toJSONSchema(schema)) as SchemaObject;
}
