import type { InternalRelationKind } from './internal/InternalRelationKind';

export type RelationKind = (typeof InternalRelationKind)[keyof typeof InternalRelationKind];

export interface RelationMeta {
    kind: RelationKind;
    table: string;
    sourceKey: string;
    targetKey: string;
    targetColumns: Record<string, string>;
    alias: string;
}
