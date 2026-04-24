/**
 * Domain boundary barrel: centralizes internal collaborators that back the
 * many-to-many related-manager APIs exposed on materialized model records.
 */

export { ThroughTableManager } from './ThroughTableManager';
export type { ThroughTableLinkDescriptor, ThroughTableManagerFromRelationInputs } from './ThroughTableManager';
