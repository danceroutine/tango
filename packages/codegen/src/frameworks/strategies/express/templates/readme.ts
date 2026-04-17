import { TemplateBuilder } from '../../../contracts/template/TemplateBuilder';
import type { FrameworkScaffoldContext } from '../../../contracts/template/ScaffoldTemplate';

export class ReadmeTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'README.md' });
    }

    protected override resolveTemplate(context: FrameworkScaffoldContext): string {
        return `# ${context.projectName}

This project was scaffolded by \`tango new --framework express\`.

Express still owns the server and route registration; Tango owns model metadata, \`Model.objects\`, serializers, migrations, querying, and resource behavior.

## First-time setup

Generate your first migration from the scaffolded models, then start the app:

\`\`\`bash
${context.packageManager} run make:migrations --name initial
${context.packageManager} run dev
\`\`\`

\`make:migrations\` also refreshes the generated relation registry for the scaffolded model module. If you later change relation metadata without needing a new migration file, run \`${context.packageManager} run codegen:relations\`.

## Scripts

- \`${context.packageManager} run dev\`
- \`${context.packageManager} run make:migrations --name add_field\`
- \`${context.packageManager} run codegen:relations\`
- \`${context.packageManager} run setup:schema\`
- \`${context.packageManager} run bootstrap\`
- \`${context.packageManager} run typecheck\`

## Useful endpoints

- \`GET /health\`
- \`GET /api/openapi.json\`
- \`GET|POST|PATCH|DELETE /api/todos...\`

## Project layout

- \`tango.config.ts\` Tango configuration
- \`src/tango.ts\` Express registration helper for Tango routes
- \`src/models/\` schemas and Tango model metadata; importing the model module enables \`Model.objects\`
- \`src/serializers/\` serializer-backed API contracts for Tango resources
- \`src/viewsets/\` CRUD resources backed by \`Model.objects\`
- \`src/openapi.ts\` OpenAPI document generation
- \`src/bootstrap.ts\` seed utility for a larger demo dataset
- \`migrations/\` checked-in Tango migrations
- \`.tango/\` generated relation typing artifacts
`;
    }
}
