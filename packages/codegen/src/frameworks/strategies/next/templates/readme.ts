import { TemplateBuilder } from '../../../contracts/template/TemplateBuilder';
import type { FrameworkScaffoldContext } from '../../../contracts/template/ScaffoldTemplate';

export class ReadmeTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'README.md' });
    }

    protected override resolveTemplate(context: FrameworkScaffoldContext): string {
        const makeMigrations = TemplateBuilder.getRunScriptCommand(context.packageManager, 'make:migrations', [
            '--name',
            'initial',
        ]);
        const makeNamedMigration = TemplateBuilder.getRunScriptCommand(context.packageManager, 'make:migrations', [
            '--name',
            'add_field',
        ]);
        const dev = TemplateBuilder.getRunScriptCommand(context.packageManager, 'dev');
        const codegenRelations = TemplateBuilder.getRunScriptCommand(context.packageManager, 'codegen:relations');
        const setupSchema = TemplateBuilder.getRunScriptCommand(context.packageManager, 'setup:schema');
        const bootstrap = TemplateBuilder.getRunScriptCommand(context.packageManager, 'bootstrap');
        const typecheck = TemplateBuilder.getRunScriptCommand(context.packageManager, 'typecheck');

        return `# ${context.projectName}

This project was scaffolded by \`tango new --framework next\`.

Next.js still owns pages and route handlers; Tango owns model metadata, \`Model.objects\`, serializers, migrations, querying, and resource behavior.

## First-time setup

Generate your first migration from the scaffolded models, then start the app:

\`\`\`bash
${makeMigrations}
${dev}
\`\`\`

\`make:migrations\` also refreshes the generated relation registry for the scaffolded model module. If you later change relation metadata without needing a new migration file, run \`${codegenRelations}\`.

## Scripts

- \`${dev}\`
- \`${makeNamedMigration}\`
- \`${codegenRelations}\`
- \`${setupSchema}\`
- \`${bootstrap}\`
- \`${typecheck}\`

## Useful endpoints

- \`GET /\` browser entry route rendered by \`src/app/page.tsx\`
- \`GET /api/health\`
- \`GET /api/openapi\`
- \`GET|POST|PATCH|DELETE /api/todos...\`

## Durable app code

- \`tango.config.ts\` Tango configuration
- \`src/lib/models/\` schemas and Tango model metadata; importing the model module enables \`Model.objects\`
- \`src/serializers/\` serializer-backed API contracts for Tango resources
- \`src/viewsets/\` CRUD resources backed by \`Model.objects\`
- \`src/app/page.tsx\` browser entry route at \`/\`; replace the Todo page once your own app shell is ready
- \`src/app/api/todos/[[...tango]]/route.ts\` Next adapter wiring for the viewset
- \`src/lib/openapi.ts\` OpenAPI document generation

## Generated artifacts

- \`.tango/\` generated relation typing artifacts; regenerate through \`make:migrations\` or \`codegen:relations\`
- \`migrations/\` checked-in Tango migrations; review them like source, but let Tango generate the files

## Utility surface

- \`scripts/bootstrap.ts\` sample seed utility; keep it if it helps your app, or replace it once your own seed flow exists
`;
    }
}
