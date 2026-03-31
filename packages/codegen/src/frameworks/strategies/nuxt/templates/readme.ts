import { TemplateBuilder } from '../../../contracts/template/TemplateBuilder';
import type { FrameworkScaffoldContext } from '../../../contracts/template/ScaffoldTemplate';

export class ReadmeTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'README.md' });
    }

    protected override resolveTemplate(context: FrameworkScaffoldContext): string {
        return `# ${context.projectName}

This project was scaffolded by \`tango new --framework nuxt\`.

Nuxt still owns pages and SSR rendering; Tango owns model metadata, \`Model.objects\`, serializers, migrations, querying, and resource behavior.

## First-time setup

Generate your first migration from the scaffolded models, then start the app:

\`\`\`bash
${context.packageManager} run make:migrations --name initial
${context.packageManager} run dev
\`\`\`

## Scripts

- \`${context.packageManager} run dev\`
- \`${context.packageManager} run make:migrations --name add_field\`
- \`${context.packageManager} run setup:schema\`
- \`${context.packageManager} run bootstrap\`
- \`${context.packageManager} run typecheck\`

## Useful endpoints

- \`GET /api/health\`
- \`GET /api/openapi\`
- \`GET|POST|PATCH|DELETE /api/todos...\`

## Project layout

- \`nuxt.config.ts\` Nuxt config and explicit Tango server handler registration
- \`tango.config.ts\` Tango configuration
- \`lib/models/\` schemas and Tango model metadata; explicit ORM registration keeps \`Model.objects\` available in SSR pages and handlers
- \`serializers/\` serializer-backed API contracts for Tango resources
- \`viewsets/\` CRUD resources backed by \`Model.objects\`
- \`app/pages/index.server.vue\` server-rendered page reading through \`TodoModel.objects\`
- \`server/tango/todos.ts\` Nuxt adapter wiring for the viewset
- \`lib/openapi.ts\` OpenAPI document generation
- \`scripts/bootstrap.ts\` seed utility for a larger demo dataset
- \`migrations/\` checked-in Tango migrations
`;
    }
}
