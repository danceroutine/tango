import type { Field } from './Field';
import type { IndexDef } from './IndexDef';
import type { RelationDef } from './RelationDef';

export interface ModelMetadata {
    namespace: string;
    name: string;
    key: string;
    table: string;
    fields: Field[];
    indexes?: IndexDef[];
    relations?: Record<string, RelationDef>;
    ordering?: string[];
    managed?: boolean;
    defaultRelatedName?: string;
    constraints?: unknown[];
}
