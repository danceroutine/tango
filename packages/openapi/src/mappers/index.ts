/**
 * Domain boundary barrel: exposes namespaced exports for Django-style drill-down
 * imports and curated flat exports for TS-native ergonomics.
 */

export * as schema from './schema/index';
export { generateSchemaFromModel, generateSchemaFromZod, mapTypeToOpenAPI } from './schema/index';
