import type { RelationHydrationLoadMode, RelationMeta } from '../../domain/RelationMeta';

export type QueryHydrationLoadMode = RelationHydrationLoadMode;

export interface QueryHydrationPlanRoot {
    joinNodes: readonly QueryHydrationPlanNode[];
    prefetchNodes: readonly QueryHydrationPlanNode[];
    requestedPaths: readonly string[];
}

export interface QueryHydrationPlanNode {
    nodeId: string;
    relationName: string;
    relationPath: string;
    ownerModelKey: string;
    relationEdge: RelationMeta;
    targetModelKey: string;
    loadMode: QueryHydrationLoadMode;
    cardinality: RelationMeta['cardinality'];
    provenance: readonly string[];
    joinChildren: readonly QueryHydrationPlanNode[];
    prefetchChildren: readonly QueryHydrationPlanNode[];
}
