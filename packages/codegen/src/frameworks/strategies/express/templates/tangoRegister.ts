import { TemplateBuilder } from '../../../contracts/template/TemplateBuilder';
import type { FrameworkScaffoldContext } from '../../../contracts/template/ScaffoldTemplate';

export class TangoRegisterTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'src/tango.ts' });
    }

    protected override resolveTemplate(_context: FrameworkScaffoldContext): string {
        return `import type { Application } from 'express';
import { ExpressAdapter } from '@danceroutine/tango-adapters-express/adapter';
import { createOpenAPISpec } from './openapi.js';
import { TodoViewSet } from './viewsets/TodoViewSet.js';

/**
 * Register Tango API routes and OpenAPI spec on an existing Express app.
 * Use from your app entry (for example, \`index.ts\`): \`await registerTango(app);\`
 */
export async function registerTango(app: Application): Promise<void> {
    const adapter = new ExpressAdapter();
    adapter.registerViewSet(app, '/api/todos', new TodoViewSet());
    app.get('/api/openapi.json', (_req, res) => {
        res.json(createOpenAPISpec());
    });
}
`;
    }
}
