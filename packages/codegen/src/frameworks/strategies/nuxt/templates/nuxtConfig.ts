import { TemplateBuilder } from '../../../contracts/template/TemplateBuilder';
import type { FrameworkScaffoldContext } from '../../../contracts/template/ScaffoldTemplate';

export class NuxtConfigTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'nuxt.config.ts' });
    }

    protected override resolveTemplate(_context: FrameworkScaffoldContext): string {
        return `import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
    compatibilityDate: '2026-03-31',
    serverHandlers: [
        { route: '/api/health', handler: './server/tango/health.ts' },
        { route: '/api/openapi', handler: './server/tango/openapi.ts' },
        { route: '/api/todos', handler: './server/tango/todos.ts' },
        { route: '/api/todos/**:tango', handler: './server/tango/todos.ts' },
    ],
});
`;
    }
}
