import type { CodegenModel } from '../../domain';
import { mapFieldTypeToTS, normalizeFields } from '../../mappers';

/**
 * Generate a TypeScript interface string from a Tango codegen model.
 */
export function generateModelInterface(model: CodegenModel): string {
    const fields = normalizeFields(model.fields)
        .map(([name, meta]) => {
            const type = mapFieldTypeToTS(meta.type);
            const optional = !meta.primaryKey && meta.default !== undefined ? '?' : '';
            return `  ${name}${optional}: ${type};`;
        })
        .join('\n');

    return `
export interface ${model.name} {
${fields}
}
  `.trim();
}
