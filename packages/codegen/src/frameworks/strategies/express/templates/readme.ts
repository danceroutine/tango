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

This project was scaffolded by \`tango new --framework express\`.

Express still owns the server and route registration; Tango owns model metadata, \`Model.objects\`, serializers, migrations, querying, and resource behavior.

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

- \`GET /health\`
- \`GET /api/openapi.json\`
- \`GET|POST|PATCH|DELETE /api/todos...\`

## Durable app code

- \`tango.config.ts\` Tango configuration
- \`src/index.ts\` Express app entrypoint; you own server boot, ports, and middleware here
- \`src/tango.ts\` Express registration helper for Tango routes and OpenAPI wiring
- \`src/models/\` schemas and Tango model metadata; importing the model module enables \`Model.objects\`
- \`src/serializers/\` serializer-backed API contracts for Tango resources
- \`src/viewsets/\` CRUD resources backed by \`Model.objects\`
- \`src/openapi.ts\` OpenAPI document generation

## Generated artifacts

- \`.tango/\` generated relation typing artifacts; regenerate through \`make:migrations\` or \`codegen:relations\`
- \`migrations/\` checked-in Tango migrations; review them like source, but let Tango generate the files

## Utility surface

- \`src/bootstrap.ts\` sample seed utility; keep it if it helps your app, or replace it once your own seed flow exists
`;
    }
}
