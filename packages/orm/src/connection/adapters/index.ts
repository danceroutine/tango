/**
 * Domain boundary barrel: exposes namespaced exports for Django-style drill-down
 * imports and curated flat exports for TS-native ergonomics.
 */

export * as dialects from './dialects/index';

export { AdapterRegistry, connectDB, getDefaultAdapterRegistry } from './AdapterRegistry';
export type { Adapter, AdapterConfig } from './Adapter';
export { PostgresAdapter, SqliteAdapter } from './dialects/index';
