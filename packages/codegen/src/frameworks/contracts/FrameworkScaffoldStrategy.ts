import {
    SCAFFOLD_TEMPLATE_CATEGORY,
    type ScaffoldTemplate,
    type ScaffoldTemplateCategory,
    type FrameworkScaffoldContext,
} from './template/ScaffoldTemplate';
import { ScaffoldTemplateDescriptor } from './template/implementation/ScaffoldTemplateDescriptor';
import { TemplateBuilder } from './template/TemplateBuilder';

export const SUPPORTED_FRAMEWORK = {
    EXPRESS: 'express',
    NEXT: 'next',
    NUXT: 'nuxt',
} as const;
export type SupportedFramework = (typeof SUPPORTED_FRAMEWORK)[keyof typeof SUPPORTED_FRAMEWORK];

export const PACKAGE_MANAGER = {
    PNPM: 'pnpm',
    NPM: 'npm',
    YARN: 'yarn',
    BUN: 'bun',
} as const;
export type PackageManager = (typeof PACKAGE_MANAGER)[keyof typeof PACKAGE_MANAGER];

export const SCAFFOLD_DATABASE_DIALECT = {
    SQLITE: 'sqlite',
    POSTGRES: 'postgres',
} as const;
export type ScaffoldDatabaseDialect = (typeof SCAFFOLD_DATABASE_DIALECT)[keyof typeof SCAFFOLD_DATABASE_DIALECT];

/**
 * Base scaffold strategy contract and helpers for Tango framework scaffolds.
 *
 * Concrete strategies extend this class and assemble their template lists
 * through the protected helpers below.
 */
export abstract class FrameworkScaffoldStrategy {
    abstract readonly id: SupportedFramework;
    abstract readonly name: string;
    abstract readonly description: string;

    /**
     * One-liner to install Tango + dialect deps and Tango CLI, for init success message.
     */
    getTangoInstallOneLiner(packageManager: PackageManager, context: FrameworkScaffoldContext): string {
        return TemplateBuilder.getTangoInstallOneLiner(packageManager, context.dialect, context.framework);
    }

    abstract getTemplates(): readonly ScaffoldTemplate[];

    protected addFrameworkTemplate(template: TemplateBuilder): ScaffoldTemplate {
        return this.createTemplate(template, SCAFFOLD_TEMPLATE_CATEGORY.FRAMEWORK);
    }

    protected addTangoTemplate(template: TemplateBuilder): ScaffoldTemplate {
        return this.createTemplate(template, SCAFFOLD_TEMPLATE_CATEGORY.TANGO);
    }

    protected addInitOnlyTemplate(template: TemplateBuilder): ScaffoldTemplate {
        return this.createTemplate(template, SCAFFOLD_TEMPLATE_CATEGORY.INIT_ONLY);
    }

    private createTemplate(template: TemplateBuilder, category: ScaffoldTemplateCategory): ScaffoldTemplate {
        return new ScaffoldTemplateDescriptor(template, category);
    }
}
