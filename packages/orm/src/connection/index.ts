/**
 * Domain boundary barrel: exposes namespaced exports for Django-style drill-down
 * imports and curated flat exports for TS-native ergonomics.
 */

export * as adapters from './adapters/index';
export * as clients from './clients/index';

export { AdapterRegistry, connectDB, getDefaultAdapterRegistry } from './adapters/index';
export type { Adapter, AdapterConfig } from './adapters/index';
export type { DBClient } from './clients/DBClient';
export { PostgresAdapter, SqliteAdapter } from './adapters/index';
export { PostgresClient, SqliteClient } from './clients/index';
