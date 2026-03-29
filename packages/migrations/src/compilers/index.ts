/**
 * Domain boundary barrel: exposes namespaced exports for Django-style drill-down
 * imports and curated flat exports for TS-native ergonomics.
 */

export * as contracts from './contracts/index';
export * as dialects from './dialects/index';
export * as factories from './factories/index';

export type { SQL, SQLCompiler, CompilerFactory } from './contracts/index';
export { PostgresCompiler, SqliteCompiler } from './dialects/index';
export * from './factories/index';
