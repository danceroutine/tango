/**
 * Domain boundary barrel: centralizes this subdomain's public contract.
 */

export {
    type FrameworkScaffoldContext,
    type ScaffoldMode,
    type ScaffoldTemplate,
    type ScaffoldTemplateCategory,
    SCAFFOLD_TEMPLATE_CATEGORY,
} from './contracts/template/ScaffoldTemplate';
export type {
    PackageManager,
    ScaffoldDatabaseDialect as ScaffoldDialect,
    SupportedFramework,
} from './contracts/FrameworkScaffoldStrategy';
export { FrameworkScaffoldStrategy } from './contracts/FrameworkScaffoldStrategy';
export { ScaffoldTemplateDescriptor } from './contracts/template/implementation/ScaffoldTemplateDescriptor';
export { FrameworkScaffoldRegistry } from './registry/FrameworkScaffoldRegistry';
export { ExpressScaffoldStrategy } from './strategies/express/ExpressScaffoldStrategy';
export { NextScaffoldStrategy } from './strategies/next/NextScaffoldStrategy';
export { NuxtScaffoldStrategy } from './strategies/nuxt/NuxtScaffoldStrategy';
export { scaffoldProject, type ScaffoldProjectOptions } from './scaffold/scaffoldProject';
