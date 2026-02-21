/**
 * Bundled exports for Django-style domain drill-down imports, plus curated
 * top-level symbols for TS-native ergonomic imports.
 */
export * as adapter from './adapter/index';
export * as domain from './domain/index';

export type { FrameworkAdapter, FrameworkAdapterOptions } from './adapter/index';
export { FRAMEWORK_ADAPTER_BRAND, isFrameworkAdapter } from './adapter/index';
// Exported because adapters-core is an internal package aimed at consumers that would act as the public interface
export { InternalHttpMethod, InternalActionScope, InternalActionMatchKind } from './domain/index';
