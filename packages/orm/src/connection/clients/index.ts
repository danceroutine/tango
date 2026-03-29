/**
 * Domain boundary barrel: exposes namespaced exports for Django-style drill-down
 * imports and curated flat exports for TS-native ergonomics.
 */

export * as dialects from './dialects/index';

export type { DBClient } from './DBClient';
export { PostgresClient, SqliteClient } from './dialects/index';
