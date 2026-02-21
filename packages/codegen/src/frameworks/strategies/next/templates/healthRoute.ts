import { TemplateBuilder } from '../../../contracts/template/TemplateBuilder';
import type { FrameworkScaffoldContext } from '../../../contracts/template/ScaffoldTemplate';

export class HealthRouteTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'src/app/api/health/route.ts' });
    }

    protected override resolveTemplate(_context: FrameworkScaffoldContext): string {
        return `export async function GET(): Promise<Response> {
    return Response.json({ ok: true });
}
`;
    }
}
