/**
 * Bundled exports for Django-style domain drill-down imports, plus curated
 * top-level symbols for TS-native ergonomic imports.
 */

export * as commands from './commands/index';
export * as domain from './domain/index';

export { createDefaultCommandModules } from './commands/index';
export type { TangoCliCommandModule } from './domain/index';
export { runCli, type RunCliOptions } from './runCli';
