import { TemplateBuilder } from '../../../contracts/template/TemplateBuilder';
import type { FrameworkScaffoldContext } from '../../../contracts/template/ScaffoldTemplate';

export class OpenAPITemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'lib/openapi.ts' });
    }

    protected override resolveTemplate(_context: FrameworkScaffoldContext): string {
        return `import { describeViewSet, generateOpenAPISpec, type OpenAPISpec } from '@danceroutine/tango-openapi';
import { TodoViewSet } from '~~/viewsets/TodoViewSet';

export function createOpenAPISpec(): OpenAPISpec {
    return generateOpenAPISpec({
        title: 'Tango Nuxt Todo API',
        version: '1.0.0',
        description: 'OpenAPI document generated from Tango resource instances.',
        resources: [describeViewSet({ basePath: '/api/todos', resource: new TodoViewSet() })],
    });
}
`;
    }
}
