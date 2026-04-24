/**
 * Domain boundary barrel: centralizes ORM relation managers attached to
 * materialized model records.
 */

export { ManyToManyRelatedQuerySet } from './ManyToManyRelatedQuerySet';
export type { ManyToManyRelatedQuerySetBridge } from './ManyToManyRelatedQuerySet';
export { ManyToManyRelatedManager } from './ManyToManyRelatedManager';
export type { ManyToManyRelatedManagerCreateInputs, ManyToManyTargetRef } from './ManyToManyRelatedManager';
export type { MaterializedModelRecord } from './MaterializedModelRecord';
