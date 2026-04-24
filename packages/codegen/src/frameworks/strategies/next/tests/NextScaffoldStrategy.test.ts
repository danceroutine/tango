import { describe, expect, it } from 'vitest';
import { SCAFFOLD_TEMPLATE_CATEGORY } from '../../../contracts/template/ScaffoldTemplate';
import { NextScaffoldStrategy } from '../NextScaffoldStrategy';
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

describe(NextScaffoldStrategy, () => {
    const validCategories = Object.values(SCAFFOLD_TEMPLATE_CATEGORY);

    describe(NextScaffoldStrategy.prototype.getTemplates, () => {
        it('includes only app shell and Tango layer (no register-only file)', () => {
            const strategy = new NextScaffoldStrategy();
            const templates = strategy.getTemplates();
            for (const t of templates) {
                expect(validCategories).toContain(t.category);
                expect(t.category).not.toBe(SCAFFOLD_TEMPLATE_CATEGORY.INIT_ONLY);
            }
        });

        it('produces a Next app with SQLite including layout, API routes, and migrations dir', () => {
            const context: FrameworkScaffoldContext = {
                projectName: 'next-sqlite',
                targetDir: '/tmp/next-sqlite',
                framework: 'next',
                packageManager: 'pnpm',
                dialect: 'sqlite',
                includeSeed: false,
            };

            const strategy = new NextScaffoldStrategy();
            const templates = strategy.getTemplates();
            const packageJson = renderTemplate(templates, 'package.json', context);
            const tsconfig = renderTemplate(templates, 'tsconfig.json', context);
            const layout = renderTemplate(templates, 'src/app/layout.tsx', context);
            const route = renderTemplate(templates, 'src/app/api/health/route.ts', context);
            const openapiRoute = renderTemplate(templates, 'src/app/api/openapi/route.ts', context);
            const openapiSource = renderTemplate(templates, 'src/lib/openapi.ts', context);
            const serializerSource = renderTemplate(templates, 'src/serializers/TodoSerializer.ts', context);
            const viewsetSource = renderTemplate(templates, 'src/viewsets/TodoViewSet.ts', context);
            const readme = renderTemplate(templates, 'README.md', context);
            const migrationsKeep = renderTemplate(templates, 'migrations/.gitkeep', context);

            expect(packageJson).toContain('"codegen:relations"');
            expect(tsconfig).toContain('"migrations/**/*.ts"');
            expect(tsconfig).toContain('".tango/**/*.d.ts"');
            expect(layout).toContain('RootLayout');
            expect(route).toContain('Response.json');
            expect(openapiRoute).toContain("from '@/lib/openapi'");
            expect(openapiSource).toContain('describeViewSet');
            expect(openapiSource).toContain(
                "resources: [describeViewSet({ basePath: '/api/todos', resource: new TodoViewSet() })]"
            );
            expect(serializerSource).toContain('export class TodoSerializer extends ModelSerializer');
            expect(viewsetSource).toContain('serializer: TodoSerializer');
            expect(readme).toContain('First-time setup');
            expect(readme).toContain('make:migrations --name initial');
            expect(readme).toContain('codegen:relations');
            expect(migrationsKeep).toBe('');
        });

        it('produces a Next app with Postgres and dialect config', () => {
            const context: FrameworkScaffoldContext = {
                projectName: 'next-postgres',
                targetDir: '/tmp/next-postgres',
                framework: 'next',
                packageManager: 'pnpm',
                dialect: 'postgres',
                includeSeed: false,
            };

            const strategy = new NextScaffoldStrategy();
            const templates = strategy.getTemplates();
            const packageJson = renderTemplate(templates, 'package.json', context);
            const config = renderTemplate(templates, 'tango.config.ts', context);

            expect(packageJson).toContain('"pg"');
            expect(packageJson).not.toContain('"better-sqlite3"');
            expect(config).toContain("adapter: 'postgres'");
        });
    });
});
