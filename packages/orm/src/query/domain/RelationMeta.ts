import type { InternalRelationKind } from './internal/InternalRelationKind';
import type { RelationHydrationCardinality } from './RelationTyping';
import type { TableMeta } from './TableMeta';

export type RelationKind = (typeof InternalRelationKind)[keyof typeof InternalRelationKind];
export const InternalRelationHydrationLoadMode = {
    JOIN: 'join',
    PREFETCH: 'prefetch',
} as const;

export type RelationHydrationLoadMode =
    (typeof InternalRelationHydrationLoadMode)[keyof typeof InternalRelationHydrationLoadMode];

export interface RelationHydrationCapabilities {
    queryable: boolean;
    hydratable: boolean;
    joinable: boolean;
    prefetchable: boolean;
}

/**
 * Runtime relation metadata consumed by validation, planning, compilation, and
 * hydration.
 */
export interface RelationMeta {
    /** Stable edge identity from the resolved relation graph. */
    edgeId: string;
    /** Model key that owns the public relation name. */
    sourceModelKey: string;
    /** Model key reached by traversing this relation. */
    targetModelKey: string;
    /** Public relation kind such as belongsTo or hasMany. */
    kind: RelationKind;
    /** Hydration cardinality used by eager-loading APIs. */
    cardinality: RelationHydrationCardinality;
    /** Capability flags distilled from the resolved relation graph. */
    capabilities: RelationHydrationCapabilities;
    /** Physical table storing the target model rows. */
    table: string;
    /** Owner-side column used to attach or query related rows. */
    sourceKey: string;
    /** Target-side column matched against the source key. */
    targetKey: string;
    /** Primary key column for the target model. */
    targetPrimaryKey: string;
    /** Target model columns and their storage types. */
    targetColumns: Record<string, string>;
    /** Deterministic alias base used by join compilation. */
    alias: string;
    /** Recursive target metadata used for nested planning. */
    targetMeta?: TableMeta;
}
