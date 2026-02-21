import type { RelationType } from './RelationType';

export interface RelationDef {
    type: RelationType;
    target: string;
    foreignKey: string;
    localKey?: string;
}
