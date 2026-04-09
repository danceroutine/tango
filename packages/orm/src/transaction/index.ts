/**
 * Domain boundary barrel: centralizes this subdomain's public contract.
 */

export { atomic } from './atomic';
export type { AtomicTransaction, OnCommitOptions, SavepointOptions, SavepointResult } from './AtomicTransaction';
export { UnitOfWork } from './UnitOfWork';
