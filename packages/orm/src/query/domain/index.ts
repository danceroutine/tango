/**
 * Domain boundary barrel: centralizes this subdomain's public contract.
 */

export type { CompiledQuery } from './CompiledQuery';
export type { Dialect } from './Dialect';
export type { Direction } from './Direction';
export type { FilterInput } from './FilterInput';
export type { FilterKey } from './FilterKey';
export type { FilterValue } from './FilterValue';
export type { LookupType } from './LookupType';
export type { OrderSpec } from './OrderSpec';
export type { OrderToken } from './OrderToken';
export type { QNode } from './QNode';
export type { QueryResult } from './QueryResult';
export type { QuerySetState } from './QuerySetState';
export type { RelationMeta } from './RelationMeta';
export type {
    ForwardSingleRelations,
    HydratedQueryResult,
    HydratedRelationMap,
    ManyRelationHydrationCardinality,
    MaybeHydratedRelationMap,
    PrefetchRelatedRelations,
    RelationKeys,
    RelationHydrationCardinality,
    ReverseCollectionRelations,
    ReverseSingleRelations,
    SelectRelatedRelations,
    SingleRelationHydrationCardinality,
} from './RelationTyping';
export { InternalRelationHydrationCardinality } from './RelationTyping';
export type { TableMeta } from './TableMeta';
export type { WhereClause } from './WhereClause';
