/**
 * Domain boundary barrel: exposes namespaced exports for Django-style drill-down
 * imports and curated flat exports for TS-native ergonomics.
 */

export * as compiler from './compiler/index';
export * as domain from './domain/index';

export type * from './domain/index';
export type { TableMeta } from './domain/index';
export { QueryResult } from './domain/index';
export { QuerySet } from './QuerySet';
export { ModelQuerySet } from './ModelQuerySet';
export type { QueryExecutor } from './QuerySet';
export { QBuilder, QBuilder as Q } from './QBuilder';
export { QueryCompiler } from './compiler/index';
