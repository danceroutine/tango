/**
 * Domain boundary barrel: exposes namespaced exports for Django-style drill-down
 * imports and curated flat exports for TS-native ergonomics.
 */

export * as domain from './domain/index';
export * as migrations from './migrations/index';
export * as conformance from './conformance/index';
export * as runtime from './runtime/index';
export * as smoke from './smoke/index';

export * from './domain/index';
export * from './anIntegrationHarness';
export * from './HarnessStrategyRegistry';
export * from './TestHarness';
export * from './migrations/index';
export * from './conformance/index';
export * from './orm/index';
export * from './runtime/index';
export * from './smoke/index';
