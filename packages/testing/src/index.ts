/**
 * Bundled exports for Django-style domain drill-down imports, plus curated
 * top-level symbols for TS-native ergonomic imports.
 */
export * as mocks from './mocks/index';
export * as factories from './factories/index';
export * as assertionsDomain from './assertions/index';
export * as integration from './integration/index';
export * as vitest from './vitest/index';
export * as express from './express/index';

export { aDBClient, aManager, aQueryResult, aQuerySet, aRequestContext, aQueryExecutor } from './mocks/index';
export { anExpressRequest, anExpressResponse } from './express/index';
export type {
    DBClient,
    ManagerOverrides,
    MockQuerySetResult,
    QueryExecutorOverrides,
    RequestContextFixtureOptions,
} from './mocks/index';
export type { ExpressRequestOverrides } from './express/index';
export { ModelDataFactory } from './factories/index';
export type { GenericModelFactory } from './factories/index';
export { assertions } from './assertions/index';

export * from './integration/index';
export { withGlobalTestApi } from './vitest/index';
