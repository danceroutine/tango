/**
 * Domain boundary barrel: exposes namespaced exports for Django-style drill-down
 * imports and curated flat exports for TS-native ergonomics.
 */

export * as spec from './spec/index';
export { generateOpenAPISpec } from './spec/index';
