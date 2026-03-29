/**
 * Database client abstraction used by ORM and migrations.
 */
export interface DBClient {
    /** Execute SQL with optional positional parameters. */
    query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<{ rows: T[] }>;
    /** Begin a transaction. */
    begin(): Promise<void>;
    /** Commit current transaction. */
    commit(): Promise<void>;
    /** Roll back current transaction. */
    rollback(): Promise<void>;
    /** Close underlying connection resources. */
    close(): Promise<void>;
}
