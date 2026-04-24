import { TemplateBuilder } from '../../../contracts/template/TemplateBuilder';
import type { FrameworkScaffoldContext } from '../../../contracts/template/ScaffoldTemplate';

export class ReadmeTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'README.md' });
    }

    protected override resolveTemplate(context: FrameworkScaffoldContext): string {
        return `# ${context.projectName}

This project was scaffolded by \`tango new --framework next\`.

Next.js still owns pages and route handlers; Tango owns model metadata, \`Model.objects\`, serializers, migrations, querying, and resource behavior.

## First-time setup

Generate your first migration from the scaffolded models, then start the app:

\`\`\`bash
${context.packageManager} run make:migrations -- --name initial
${context.packageManager} run dev
\`\`\`

\`make:migrations\` also refreshes the generated relation registry for the scaffolded model module. If you later change relation metadata without needing a new migration file, run \`${context.packageManager} run codegen:relations\`.

When you run the package script, pass Tango flags after \`--\` so the script forwards them to the CLI unchanged.

## Scripts

- \`${context.packageManager} run dev\`
- \`${context.packageManager} run make:migrations -- --name add_field\`
- \`${context.packageManager} run codegen:relations\`
- \`${context.packageManager} run setup:schema\`
- \`${context.packageManager} run bootstrap\`
- \`${context.packageManager} run typecheck\`

## Useful endpoints

- \`GET /api/health\`
- \`GET /api/openapi\`
- \`GET|POST|PATCH|DELETE /api/todos...\`

## Project layout

- \`tango.config.ts\` Tango configuration
- \`src/lib/models/\` schemas and Tango model metadata; importing the model module enables \`Model.objects\`
- \`src/serializers/\` serializer-backed API contracts for Tango resources
- \`src/viewsets/\` CRUD resources backed by \`Model.objects\`
- \`src/app/page.tsx\` server-rendered page reading through \`TodoModel.objects\`
- \`src/app/api/todos/[[...tango]]/route.ts\` Next adapter wiring for the viewset
- \`src/lib/openapi.ts\` OpenAPI document generation
- \`scripts/bootstrap.ts\` seed utility for a larger demo dataset
- \`migrations/\` checked-in Tango migrations
- \`.tango/\` generated relation typing artifacts
`;
    }
}
