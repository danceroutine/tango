import type { SupportedFramework, PackageManager, ScaffoldDatabaseDialect } from '../FrameworkScaffoldStrategy';

export const SCAFFOLD_TEMPLATE_CATEGORY = {
    FRAMEWORK: 'framework',
    TANGO: 'tango',
    INIT_ONLY: 'init-only',
} as const;
export type ScaffoldTemplateCategory = (typeof SCAFFOLD_TEMPLATE_CATEGORY)[keyof typeof SCAFFOLD_TEMPLATE_CATEGORY];

export type ScaffoldMode = 'new' | 'init';

export type FrameworkScaffoldContext = {
    projectName: string;
    targetDir: string;
    framework: SupportedFramework;
    packageManager: PackageManager;
    dialect: ScaffoldDatabaseDialect;
    includeSeed: boolean;
};

export interface ScaffoldTemplate {
    readonly path: string;
    readonly category: ScaffoldTemplateCategory;
    render(ctx: FrameworkScaffoldContext): string;
    shouldEmit(mode: ScaffoldMode): boolean;
}
