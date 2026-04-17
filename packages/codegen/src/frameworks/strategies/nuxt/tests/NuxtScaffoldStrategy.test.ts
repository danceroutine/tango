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
            const page = renderTemplate(templates, 'app/pages/index.server.vue', context);
            const route = renderTemplate(templates, 'server/tango/health.ts', context);
            const openapiRoute = renderTemplate(templates, 'server/tango/openapi.ts', context);
            const openapiSource = renderTemplate(templates, 'lib/openapi.ts', context);
            const serializerSource = renderTemplate(templates, 'serializers/TodoSerializer.ts', context);
            const viewsetSource = renderTemplate(templates, 'viewsets/TodoViewSet.ts', context);
            const readme = renderTemplate(templates, 'README.md', context);
            const migrationsKeep = renderTemplate(templates, 'migrations/.gitkeep', context);

            expect(packageJson).toContain('"nuxt"');
            expect(packageJson).toContain('"codegen:relations"');
            expect(packageJson).toContain('"start": "NUXT_TELEMETRY_DISABLED=1 nuxt preview"');
            expect(nuxtConfig).toContain("route: '/api/todos/**:tango'");
            expect(page).toContain('<script setup lang="ts">');
            expect(route).toContain('defineEventHandler');
            expect(openapiRoute).toContain("from '~~/lib/openapi'");
            expect(openapiSource).toContain('describeViewSet');
            expect(openapiSource).toContain("title: 'Tango Nuxt Todo API'");
            expect(serializerSource).toContain("from '~~/lib/models'");
            expect(viewsetSource).toContain("from '~~/serializers'");
            expect(readme).toContain('tango new --framework nuxt');
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
            expect(packageJson).not.toContain('"better-sqlite3"');
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
    });
});
