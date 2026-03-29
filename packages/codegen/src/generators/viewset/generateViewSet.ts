/**
 * Generate a `ModelViewSet` scaffold wired directly to a Tango model.
 */
export function generateViewSet(modelName: string): string {
    return `
import { ModelViewSet } from '@danceroutine/tango-resources';
import { FilterSet } from '@danceroutine/tango-resources';
import { type ${modelName} } from './models';
import { ${modelName}Serializer } from './serializers';

export class ${modelName}ViewSet extends ModelViewSet<${modelName}, typeof ${modelName}Serializer> {
  constructor() {
    super({
      serializer: ${modelName}Serializer,
      filters: FilterSet.define<typeof ${modelName}>({
        fields: {
          // Add filters here
        },
      }),
      orderingFields: ['id'],
    });
  }

  // Add custom actions here
}
  `.trim();
}
