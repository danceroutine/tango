import type { RelationHydrationLoadMode } from './RelationMeta';
import type { RelationHydrationCardinality } from './RelationTyping';

export interface CompiledQuery {
    sql: string;
    params: readonly unknown[];
    hydrationPlan?: CompiledHydrationPlanRoot;
}

export interface CompiledHydrationPlanRoot {
    requestedPaths: readonly string[];
    hiddenRootAliases: readonly string[];
    joinNodes: readonly CompiledHydrationNode[];
    prefetchNodes: readonly CompiledHydrationNode[];
}

export interface CompiledHydrationNode {
    nodeId: string;
    relationName: string;
    relationPath: string;
    ownerModelKey: string;
    targetModelKey: string;
    loadMode: RelationHydrationLoadMode;
    cardinality: RelationHydrationCardinality;
    sourceKey: string;
    ownerSourceAccessor: string;
    targetKey: string;
    targetTable: string;
    targetPrimaryKey: string;
    targetColumns: Record<string, string>;
    provenance: readonly string[];
    joinChildren: readonly CompiledHydrationNode[];
    prefetchChildren: readonly CompiledHydrationNode[];
    join?: CompiledJoinHydrationDescriptor;
}

export interface CompiledJoinHydrationDescriptor {
    alias: string;
    columns: Record<string, string>;
}

export interface CompiledPrefetchQuery {
    sql: string;
    params: readonly unknown[];
    targetKey: string;
    targetColumns: Record<string, string>;
}
