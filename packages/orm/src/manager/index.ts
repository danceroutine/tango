/**
 * Domain boundary barrel: centralizes manager-first ORM APIs.
 */
export * as relations from './relations/index';

export type { ManagerLike } from './ManagerLike';
export { ModelManager } from './ModelManager';
export { registerModelObjects } from './registerModelObjects';
export { ManyToManyRelatedQuerySet } from './relations/ManyToManyRelatedQuerySet';
export type { ManyToManyRelatedQuerySetBridge } from './relations/ManyToManyRelatedQuerySet';
export { ManyToManyRelatedManager } from './relations/ManyToManyRelatedManager';
export type { ManyToManyRelatedManagerCreateInputs, ManyToManyTargetRef } from './relations/ManyToManyRelatedManager';
export type { MaterializedModelRecord } from './relations/MaterializedModelRecord';
