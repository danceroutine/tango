import { TemplateBuilder } from '../../../contracts/template/TemplateBuilder';
import type { FrameworkScaffoldContext } from '../../../contracts/template/ScaffoldTemplate';

export class HealthRouteTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'server/tango/health.ts' });
    }

    protected override resolveTemplate(_context: FrameworkScaffoldContext): string {
        return `export default defineEventHandler(() => ({ ok: true }));
`;
    }
}
