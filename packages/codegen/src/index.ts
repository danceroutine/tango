/**
 * Bundled exports for Django-style domain drill-down imports, plus curated
 * top-level symbols for TS-native ergonomic imports.
 */
export * as domain from './domain/index';
export * as generators from './generators/index';
export * as mappers from './mappers/index';
export * as frameworks from './frameworks/index';
export * as commands from './commands/index';

export type { CodegenFieldMeta, CodegenModel } from './domain/index';
export { generateMigrationFromModels, generateModelInterface, generateViewSet } from './generators/index';
export { mapFieldTypeToTS, normalizeFields } from './mappers/index';
export {
    FrameworkScaffoldRegistry,
    ExpressScaffoldStrategy,
    NextScaffoldStrategy,
    NuxtScaffoldStrategy,
    scaffoldProject,
} from './frameworks/index';
export type {
    FrameworkScaffoldContext,
    FrameworkScaffoldStrategy,
    PackageManager,
    ScaffoldDialect,
    SupportedFramework,
} from './frameworks/index';
export { registerCodegenCommands } from './commands/index';
