import type { RelationMeta } from './RelationMeta';

export interface TableMeta {
    table: string;
    pk: string;
    columns: Record<string, string>;
    relations?: Record<string, RelationMeta>;
}
