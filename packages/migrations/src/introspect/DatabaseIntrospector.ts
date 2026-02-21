import type { DbSchema } from './PostgresIntrospector';

/**
 * Minimal DB client shape required by schema introspection.
 */
export interface DBClient {
    /** Execute a SQL statement and return row results. */
    query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<{ rows: T[] }>;
}

/**
 * Dialect-specific schema introspection contract.
 */
export interface DatabaseIntrospector {
    /** Read the current database schema state. */
    introspect(client: DBClient): Promise<DbSchema>;
}
