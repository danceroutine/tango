import { TemplateBuilder } from '../../../contracts/template/TemplateBuilder';
import type { FrameworkScaffoldContext } from '../../../contracts/template/ScaffoldTemplate';

export class OpenAPIRouteTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'server/tango/openapi.ts' });
    }

    protected override resolveTemplate(_context: FrameworkScaffoldContext): string {
        return `import { createOpenAPISpec } from '~~/lib/openapi';

export default defineEventHandler(() => createOpenAPISpec());
`;
    }
}
