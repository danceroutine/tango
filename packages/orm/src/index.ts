/**
 * Bundled exports for Django users who are used to Django domain-drill-down imports
 */
export * as connection from './connection/index';
export * as manager from './manager/index';
export * as query from './query/index';
export * as runtime from './runtime/index';
export * as transaction from './transaction/index';
/**
 * Unbundled exports for more TS native developers
 */
export { AdapterRegistry, connectDB, getDefaultAdapterRegistry } from './connection/index';
export type { Adapter, AdapterConfig, DBClient } from './connection/index';
export { PostgresAdapter, SqliteAdapter } from './connection/index';
export { ManyToManyRelatedManager, ModelManager } from './manager/index';
export type { ManagerLike, ManyToManyTargetRef, MaterializedModelRecord } from './manager/index';

export { Q, QBuilder, QueryCompiler, QueryResult, QuerySet, ModelQuerySet } from './query/index';
export type { QueryExecutor } from './query/index';
export type {
    CompiledQuery,
    Dialect,
    Direction,
    FilterInput,
    FilterKey,
    FilterValue,
    LookupType,
    OrderSpec,
    OrderToken,
    QNode,
    QuerySetState,
    RelationMeta,
    TableMeta,
    WhereClause,
} from './query/domain/index';

export { getTangoRuntime, initializeTangoRuntime, resetTangoRuntime, TangoRuntime } from './runtime/index';
export { atomic, UnitOfWork } from './transaction/index';
export type { AtomicTransaction, OnCommitOptions, SavepointOptions, SavepointResult } from './transaction/index';
