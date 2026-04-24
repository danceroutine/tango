import { describe, expect, it } from 'vitest';
import { SCAFFOLD_TEMPLATE_CATEGORY } from '../../../contracts/template/ScaffoldTemplate';
import { NuxtScaffoldStrategy } from '../NuxtScaffoldStrategy';
import type { FrameworkScaffoldContext, ScaffoldTemplate } from '../../../contracts/template/ScaffoldTemplate';
import { TodoModelTemplateBuilder } from '../templates/models';

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

describe(NuxtScaffoldStrategy, () => {
    const validCategories = Object.values(SCAFFOLD_TEMPLATE_CATEGORY);

    describe(NuxtScaffoldStrategy.prototype.getTemplates, () => {
        it('includes only framework shell and Tango layer files', () => {
            const strategy = new NuxtScaffoldStrategy();
            const templates = strategy.getTemplates();
            for (const template of templates) {
                expect(validCategories).toContain(template.category);
                expect(template.category).not.toBe(SCAFFOLD_TEMPLATE_CATEGORY.INIT_ONLY);
            }
        });

        it('produces a Nuxt app with SQLite including pages, Nitro handlers, and migrations dir', () => {
            const context: FrameworkScaffoldContext = {
                projectName: 'nuxt-sqlite',
                targetDir: '/tmp/nuxt-sqlite',
                framework: 'nuxt',
                packageManager: 'pnpm',
                dialect: 'sqlite',
                includeSeed: false,
            };

            const strategy = new NuxtScaffoldStrategy();
            const templates = strategy.getTemplates();
            const packageJson = renderTemplate(templates, 'package.json', context);
            const nuxtConfig = renderTemplate(templates, 'nuxt.config.ts', context);
            const tsconfig = renderTemplate(templates, 'tsconfig.json', context);
            const page = renderTemplate(templates, 'app/pages/index.server.vue', context);
            const route = renderTemplate(templates, 'server/tango/health.ts', context);
            const openapiRoute = renderTemplate(templates, 'server/tango/openapi.ts', context);
            const openapiSource = renderTemplate(templates, 'lib/openapi.ts', context);
            const serializerSource = renderTemplate(templates, 'serializers/TodoSerializer.ts', context);
            const viewsetSource = renderTemplate(templates, 'viewsets/TodoViewSet.ts', context);
            const readme = renderTemplate(templates, 'README.md', context);
            const migrationsKeep = renderTemplate(templates, 'migrations/.gitkeep', context);
            const scripts = JSON.parse(packageJson).scripts as Record<string, string>;

            expect(packageJson).toContain('"nuxt"');
            expect(packageJson).toContain('"better-sqlite3"');
            expect(packageJson).toContain('"pg"');
            expect(packageJson).toContain('"@types/better-sqlite3"');
            expect(packageJson).toContain('"codegen:relations"');
            expect(scripts['make:migrations']).not.toContain('--name');
            expect(scripts['make:migrations']).not.toContain('npm_config_name');
            expect(packageJson).toContain('"start": "NUXT_TELEMETRY_DISABLED=1 nuxt preview"');
            expect(nuxtConfig).toContain("route: '/api/todos/**:tango'");
            expect(tsconfig).toContain('".tango/**/*.d.ts"');
            expect(page).toContain('<script setup lang="ts">');
            expect(page).toContain("from '~~/lib/models'");
            expect(route).toContain('defineEventHandler');
            expect(openapiRoute).toContain("from '~~/lib/openapi'");
            expect(openapiSource).toContain('describeViewSet');
            expect(openapiSource).toContain("title: 'Tango Nuxt Todo API'");
            expect(serializerSource).toContain("from '~~/lib/models'");
            expect(viewsetSource).toContain("from '~~/serializers'");
            expect(readme).toContain('tango new --framework nuxt');
            expect(readme).toContain('pnpm run make:migrations --name initial');
            expect(readme).toContain('GET /');
            expect(readme).toContain('Nuxt owns the public page route at `/`');
            expect(readme).toContain('## Durable app code');
            expect(readme).toContain('## Generated artifacts');
            expect(readme).toContain('## Utility surface');
            expect(readme).toContain('codegen:relations');
            expect(readme).toContain('server/tango/todos.ts');
            expect(migrationsKeep).toBe('');
        });

        it('produces a Nuxt app with Postgres and dialect config', () => {
            const context: FrameworkScaffoldContext = {
                projectName: 'nuxt-postgres',
                targetDir: '/tmp/nuxt-postgres',
                framework: 'nuxt',
                packageManager: 'pnpm',
                dialect: 'postgres',
                includeSeed: false,
            };

            const strategy = new NuxtScaffoldStrategy();
            const templates = strategy.getTemplates();
            const packageJson = renderTemplate(templates, 'package.json', context);
            const config = renderTemplate(templates, 'tango.config.ts', context);

            expect(packageJson).toContain('"pg"');
            expect(packageJson).toContain('"better-sqlite3"');
            expect(packageJson).toContain('"@types/better-sqlite3"');
            expect(config).toContain("adapter: 'postgres'");
        });

        it('supports the static model template context helper', () => {
            const context: FrameworkScaffoldContext = {
                projectName: 'nuxt-sqlite',
                targetDir: '/tmp/nuxt-sqlite',
                framework: 'nuxt',
                packageManager: 'pnpm',
                dialect: 'sqlite',
                includeSeed: false,
            };

            const modelSource = TodoModelTemplateBuilder.context(context).build();

            expect(modelSource).toContain('export const TodoModel = Model(');
            expect(modelSource).toContain('export const TodoReadSchema = z.object({');
        });

        it('does not emit Express or Next-specific files', () => {
            const strategy = new NuxtScaffoldStrategy();
            const templatePaths = new Set(strategy.getTemplates().map((template) => template.path));

            expect(templatePaths.has('src/tango.ts')).toBe(false);
            expect(templatePaths.has('src/index.ts')).toBe(false);
            expect(templatePaths.has('src/app/layout.tsx')).toBe(false);
            expect(templatePaths.has('next.config.mjs')).toBe(false);
        });
    });
});
