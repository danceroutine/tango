import type { QuerySetState } from '../domain/QuerySetState';
import type { TableMeta } from '../domain/TableMeta';
import { InternalRelationHydrationLoadMode, type RelationMeta } from '../domain/RelationMeta';
import { InternalRelationHydrationCardinality } from '../domain/RelationTyping';
import type { QueryHydrationPlanNode, QueryHydrationPlanRoot } from './domain/QueryHydrationPlan';
import { InternalRelationKind } from '../domain/internal/InternalRelationKind';

type RequestedMode = 'select' | 'prefetch';

type TraversalTrieNode = {
    segment: string;
    relationEdge: RelationMeta;
    relationPath: string;
    targetMeta: TableMeta;
    provenance: Set<string>;
    children: Map<string, TraversalTrieNode>;
};

/**
 * Parse, validate, normalize, and plan recursive relation hydration paths.
 */
export class QueryPlanner {
    static readonly BRAND = 'tango.orm.query_planner' as const;
    readonly __tangoBrand: typeof QueryPlanner.BRAND = QueryPlanner.BRAND;

    constructor(private readonly meta: TableMeta) {}

    static isQueryPlanner(value: unknown): value is QueryPlanner {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === QueryPlanner.BRAND
        );
    }

    plan<T>(state: QuerySetState<T>): QueryHydrationPlanRoot {
        const requestedPaths = Array.from(new Set([...(state.selectRelated ?? []), ...(state.prefetchRelated ?? [])]));
        if (requestedPaths.length === 0) {
            return {
                joinNodes: [],
                prefetchNodes: [],
                requestedPaths: [],
            };
        }

        const rootChildren = new Map<string, TraversalTrieNode>();
        for (const relationPath of new Set(state.selectRelated ?? [])) {
            this.addPath(rootChildren, relationPath, 'select');
        }
        for (const relationPath of new Set(state.prefetchRelated ?? [])) {
            this.addPath(rootChildren, relationPath, 'prefetch');
        }

        const { joinNodes, prefetchNodes } = this.buildPlannedChildren(rootChildren);
        return {
            joinNodes,
            prefetchNodes,
            requestedPaths,
        };
    }

    private addPath(rootChildren: Map<string, TraversalTrieNode>, relationPath: string, mode: RequestedMode): void {
        const segments = relationPath.split('__').filter(Boolean);
        if (segments.length === 0) {
            throw new Error(`Invalid empty relation path '${relationPath}'.`);
        }

        let currentMeta = this.meta;
        let currentChildren = rootChildren;
        let builtPath = '';
        let containsCollection = false;

        for (const segment of segments) {
            const relation = currentMeta.relations?.[segment];
            if (!relation) {
                throw new Error(`Unknown relation path '${relationPath}' for table '${currentMeta.table}'.`);
            }
            if (segment in currentMeta.columns && relation.sourceKey !== segment) {
                throw new Error(
                    `Relation path '${relationPath}' collides with an existing field on table '${currentMeta.table}'.`
                );
            }
            if (relation.kind === InternalRelationKind.MANY_TO_MANY) {
                throw new Error(`Relation path '${relationPath}' uses unsupported many-to-many hydration.`);
            }
            if (!relation.capabilities.queryable || !relation.capabilities.hydratable) {
                throw new Error(`Relation path '${relationPath}' cannot be hydrated.`);
            }

            if (mode === 'select') {
                if (
                    relation.cardinality !== InternalRelationHydrationCardinality.SINGLE ||
                    !relation.capabilities.joinable
                ) {
                    throw new Error(`Relation path '${relationPath}' cannot be loaded with selectRelated(...).`);
                }
            } else if (relation.cardinality === InternalRelationHydrationCardinality.MANY) {
                if (!relation.capabilities.prefetchable) {
                    throw new Error(`Relation path '${relationPath}' cannot be loaded with prefetchRelated(...).`);
                }
                containsCollection = true;
            } else if (!relation.capabilities.joinable) {
                throw new Error(`Relation path '${relationPath}' cannot be loaded with prefetchRelated(...).`);
            }

            const targetMeta = relation.targetMeta;
            if (!targetMeta) {
                throw new Error(`Relation path '${relationPath}' is missing target metadata.`);
            }

            builtPath = builtPath.length > 0 ? `${builtPath}__${segment}` : segment;
            const existing = currentChildren.get(segment);
            const nextNode =
                existing ??
                ({
                    segment,
                    relationEdge: relation,
                    relationPath: builtPath,
                    targetMeta,
                    provenance: new Set<string>(),
                    children: new Map<string, TraversalTrieNode>(),
                } satisfies TraversalTrieNode);
            nextNode.provenance.add(relationPath);
            currentChildren.set(segment, nextNode);
            currentChildren = nextNode.children;
            currentMeta = targetMeta;
        }

        if (mode === 'prefetch' && !containsCollection) {
            throw new Error(`Relation path '${relationPath}' cannot be loaded with prefetchRelated(...).`);
        }
    }

    private buildPlannedChildren(children: Map<string, TraversalTrieNode>): {
        joinNodes: QueryHydrationPlanNode[];
        prefetchNodes: QueryHydrationPlanNode[];
    } {
        const joinNodes: QueryHydrationPlanNode[] = [];
        const prefetchNodes: QueryHydrationPlanNode[] = [];

        for (const child of children.values()) {
            const { joinNodes: joinChildren, prefetchNodes: prefetchChildren } = this.buildPlannedChildren(
                child.children
            );
            const plannedNode: QueryHydrationPlanNode = {
                nodeId: child.relationPath,
                relationName: child.segment,
                relationPath: child.relationPath,
                ownerModelKey: child.relationEdge.sourceModelKey,
                relationEdge: child.relationEdge,
                targetModelKey: child.relationEdge.targetModelKey,
                loadMode:
                    child.relationEdge.cardinality === InternalRelationHydrationCardinality.SINGLE
                        ? InternalRelationHydrationLoadMode.JOIN
                        : InternalRelationHydrationLoadMode.PREFETCH,
                cardinality: child.relationEdge.cardinality,
                provenance: [...child.provenance],
                joinChildren,
                prefetchChildren,
            };

            if (plannedNode.loadMode === InternalRelationHydrationLoadMode.JOIN) {
                joinNodes.push(plannedNode);
            } else {
                prefetchNodes.push(plannedNode);
            }
        }

        return { joinNodes, prefetchNodes };
    }
}
