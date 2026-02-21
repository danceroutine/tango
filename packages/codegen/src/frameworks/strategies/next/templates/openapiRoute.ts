import { TemplateBuilder } from '../../../contracts/template/TemplateBuilder';
import type { FrameworkScaffoldContext } from '../../../contracts/template/ScaffoldTemplate';

export class OpenAPIRouteTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'src/app/api/openapi/route.ts' });
    }

    protected override resolveTemplate(_context: FrameworkScaffoldContext): string {
        return `import { createOpenAPISpec } from '@/lib/openapi';

export async function GET(): Promise<Response> {
    return Response.json(createOpenAPISpec());
}
`;
    }
}
