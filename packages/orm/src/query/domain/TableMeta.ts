import type { RelationMeta } from './RelationMeta';

/**
 * SQL-facing model metadata visible to the ORM layer.
 */
export interface TableMeta {
    /** Stable model key when the table comes from a registered Tango model. */
    modelKey?: string;
    /** Physical table name used in compiled SQL. */
    table: string;
    /** Primary key column name. */
    pk: string;
    /** Base columns and their storage types. */
    columns: Record<string, string>;
    /** Relation metadata keyed by public relation name. */
    relations?: Record<string, RelationMeta>;
}
