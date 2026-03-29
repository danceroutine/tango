import { describe, expect, it } from 'vitest';
import { SCAFFOLD_TEMPLATE_CATEGORY } from '../../../contracts/template/ScaffoldTemplate';
import { ExpressScaffoldStrategy } from '../ExpressScaffoldStrategy';
import type { FrameworkScaffoldContext, ScaffoldTemplate } from '../../../contracts/template/ScaffoldTemplate';

function renderTemplate(
    templates: readonly ScaffoldTemplate[],
    path: string,
    context: FrameworkScaffoldContext
): string {
    const template = templates.find((entry) => entry.path === path);
    if (!template) {
        throw new Error(`Missing template: ${path}`);
    }
    return template.render(context);
}

describe(ExpressScaffoldStrategy, () => {
    const validCategories = Object.values(SCAFFOLD_TEMPLATE_CATEGORY);

    describe(ExpressScaffoldStrategy.prototype.getTemplates, () => {
        it('produces full Express project with SQLite app entry and Tango API', () => {
            const context: FrameworkScaffoldContext = {
                projectName: 'express-sqlite',
                targetDir: '/tmp/express-sqlite',
                framework: 'express',
                packageManager: 'pnpm',
                dialect: 'sqlite',
                includeSeed: true,
            };

            const strategy = new ExpressScaffoldStrategy();
            const templates = strategy.getTemplates();
            const packageJson = renderTemplate(templates, 'package.json', context);
            const config = renderTemplate(templates, 'tango.config.ts', context);
            const tsconfig = renderTemplate(templates, 'tsconfig.json', context);
            const indexSource = renderTemplate(templates, 'src/index.ts', context);
            const openapiSource = renderTemplate(templates, 'src/openapi.ts', context);
            const serializerSource = renderTemplate(templates, 'src/serializers/TodoSerializer.ts', context);
            const viewsetSource = renderTemplate(templates, 'src/viewsets/TodoViewSet.ts', context);
            const readme = renderTemplate(templates, 'README.md', context);
            const migrationsKeep = renderTemplate(templates, 'migrations/.gitkeep', context);

            expect(packageJson).toContain('"better-sqlite3"');
            expect(packageJson).not.toContain('"pg"');
            expect(packageJson).toContain('"@danceroutine/tango-openapi"');
            expect(config).toContain("adapter: 'sqlite'");
            expect(config).toContain('./.data/express-sqlite.sqlite');
            expect((JSON.parse(tsconfig) as { include: string[] }).include).toContain('migrations/**/*.ts');
            expect(indexSource).toContain("from './tango.js'");
            expect(openapiSource).toContain('describeViewSet');
            expect(openapiSource).toContain(
                "resources: [describeViewSet({ basePath: '/api/todos', resource: new TodoViewSet() })]"
            );
            expect(serializerSource).toContain('export class TodoSerializer extends ModelSerializer');
            expect(viewsetSource).toContain('serializer: TodoSerializer');
            expect(indexSource).toContain('await registerTango(app)');
            expect(readme).toContain('First-time setup');
            expect(readme).toContain('make:migrations --name initial');
            expect(migrationsKeep).toBe('');
        });

        it('produces Express project with Postgres and database URL config', () => {
            const context: FrameworkScaffoldContext = {
                projectName: 'express-postgres',
                targetDir: '/tmp/express-postgres',
                framework: 'express',
                packageManager: 'pnpm',
                dialect: 'postgres',
                includeSeed: true,
            };

            const strategy = new ExpressScaffoldStrategy();
            const templates = strategy.getTemplates();
            const packageJson = renderTemplate(templates, 'package.json', context);
            const config = renderTemplate(templates, 'tango.config.ts', context);

            expect(packageJson).toContain('"pg"');
            expect(packageJson).not.toContain('"better-sqlite3"');
            expect(config).toContain("adapter: 'postgres'");
            expect(config).toContain('TANGO_DATABASE_URL');
        });

        it('emits no init-only files because the Tango registration module is shared', () => {
            const strategy = new ExpressScaffoldStrategy();
            const templates = strategy.getTemplates();
            const initOnly = templates.filter((t) => t.category === SCAFFOLD_TEMPLATE_CATEGORY.INIT_ONLY);
            expect(initOnly).toHaveLength(0);
        });

        it('classifies every file as app shell, Tango layer, or register-only', () => {
            const strategy = new ExpressScaffoldStrategy();
            const templates = strategy.getTemplates();
            for (const t of templates) {
                expect(validCategories).toContain(t.category);
            }
        });

        it('register-only file exports mount function and wires todos and OpenAPI routes', () => {
            const context: FrameworkScaffoldContext = {
                projectName: 'p',
                targetDir: '/t',
                framework: 'express',
                packageManager: 'pnpm',
                dialect: 'sqlite',
                includeSeed: true,
            };
            const strategy = new ExpressScaffoldStrategy();
            const templates = strategy.getTemplates();
            const tangoSource = renderTemplate(templates, 'src/tango.ts', context);
            expect(tangoSource).toContain('export async function registerTango(app: Application)');
            expect(tangoSource).toContain("adapter.registerViewSet(app, '/api/todos'");
            expect(tangoSource).toContain('/api/openapi.json');
        });
    });
});
