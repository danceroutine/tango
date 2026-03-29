/**
 * Domain boundary barrel: centralizes this subdomain's public contract.
 */

export type { DBClient, DatabaseIntrospector } from './DatabaseIntrospector';
export {
    PostgresIntrospector,
    type DbColumn as PostgresDbColumn,
    type DbForeignKey as PostgresDbForeignKey,
    type DbIndex as PostgresDbIndex,
    type DbSchema as PostgresDbSchema,
    type DbTable as PostgresDbTable,
} from './PostgresIntrospector';
export {
    SqliteIntrospector,
    type DbColumn as SqliteDbColumn,
    type DbSchema as SqliteDbSchema,
    type DbTable as SqliteDbTable,
} from './SqliteIntrospector';
