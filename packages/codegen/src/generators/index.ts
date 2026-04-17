/**
 * Domain boundary barrel: exposes namespaced exports for Django-style drill-down
 * imports and curated flat exports for TS-native ergonomics.
 */

export * as migration from './migration/index';
export * as model from './model/index';
export * as relations from './relations/index';
export * as viewset from './viewset/index';

export { generateModelInterface } from './model/index';
export { generateMigrationFromModels } from './migration/index';
export { generateRelationRegistryArtifacts, writeRelationRegistryArtifacts } from './relations/index';
export { generateViewSet } from './viewset/index';
