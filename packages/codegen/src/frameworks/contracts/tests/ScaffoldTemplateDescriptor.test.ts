import { describe, expect, it } from 'vitest';
import { SCAFFOLD_TEMPLATE_CATEGORY } from '../template/ScaffoldTemplate';
import type { FrameworkScaffoldContext } from '../template/ScaffoldTemplate';
import { TemplateBuilder } from '../template/TemplateBuilder';
import { ScaffoldTemplateDescriptor } from '../template/implementation/ScaffoldTemplateDescriptor';

const noopTemplate = TemplateBuilder.createStaticTemplate('x', '');

describe(ScaffoldTemplateDescriptor, () => {
    describe(ScaffoldTemplateDescriptor.prototype.shouldEmit, () => {
        it('includes app shell and Tango-layer templates when creating a new project', () => {
            const appShell = new ScaffoldTemplateDescriptor(noopTemplate, SCAFFOLD_TEMPLATE_CATEGORY.FRAMEWORK);
            const tangoLayer = new ScaffoldTemplateDescriptor(noopTemplate, SCAFFOLD_TEMPLATE_CATEGORY.TANGO);
            expect(appShell.shouldEmit('new')).toBe(true);
            expect(tangoLayer.shouldEmit('new')).toBe(true);
        });

        it('excludes register-only template when creating a new project', () => {
            const registerOnly = new ScaffoldTemplateDescriptor(noopTemplate, SCAFFOLD_TEMPLATE_CATEGORY.INIT_ONLY);
            expect(registerOnly.shouldEmit('new')).toBe(false);
        });

        it('includes Tango-layer and register-only templates when adding to an existing project', () => {
            const tangoLayer = new ScaffoldTemplateDescriptor(noopTemplate, SCAFFOLD_TEMPLATE_CATEGORY.TANGO);
            const registerOnly = new ScaffoldTemplateDescriptor(noopTemplate, SCAFFOLD_TEMPLATE_CATEGORY.INIT_ONLY);
            expect(tangoLayer.shouldEmit('init')).toBe(true);
            expect(registerOnly.shouldEmit('init')).toBe(true);
        });

        it('excludes app shell when adding to an existing project', () => {
            const appShell = new ScaffoldTemplateDescriptor(noopTemplate, SCAFFOLD_TEMPLATE_CATEGORY.FRAMEWORK);
            expect(appShell.shouldEmit('init')).toBe(false);
        });
    });

    describe(ScaffoldTemplateDescriptor.prototype.render, () => {
        it('produces content from project context', () => {
            const ctx: FrameworkScaffoldContext = {
                projectName: 'p',
                targetDir: '/t',
                framework: 'express',
                packageManager: 'pnpm',
                dialect: 'sqlite',
                includeSeed: true,
            };
            class NameTemplateBuilder extends TemplateBuilder {
                constructor() {
                    super({ name: 'out.txt' });
                }
                protected resolveTemplate(c: FrameworkScaffoldContext): string {
                    return `name=${c.projectName}`;
                }
            }
            const descriptor = new ScaffoldTemplateDescriptor(
                new NameTemplateBuilder(),
                SCAFFOLD_TEMPLATE_CATEGORY.TANGO
            );
            expect(descriptor.render(ctx)).toBe('name=p');
        });
    });
});
