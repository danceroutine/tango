/**
 * Domain boundary barrel: centralizes this subdomain's public contract.
 */

export { aDBClient } from './aDBClient';
export { aManager } from './aManager';
export { aQueryResult } from './aQueryResult';
export { aQuerySet } from './aQuerySet';
export { aRequestContext } from './aRequestContext';
export { aQueryExecutor } from './aQueryExecutor';
export { aRelationMeta } from './aRelationMeta';
export type { QueryExecutorOverrides } from './aQueryExecutor';
export type { ManagerOverrides } from './aManager';
export type { DBClient } from './DBClient';
export type { MockQuerySetResult } from './MockQuerySetResult';
export type { RequestContextFixtureOptions } from './aRequestContext';
