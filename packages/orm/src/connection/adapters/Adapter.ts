import type { DBClient } from '../clients/DBClient';
import type { Dialect } from '../../query/domain/Dialect';

/**
 * Connection options shared by built-in DB adapters.
 */
export interface AdapterConfig {
    url?: string;
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    filename?: string;
    maxConnections?: number;
}

/**
 * Dialect-aware SQL parameter placeholder generator supplied by an
 * {@link Adapter}. Consolidates the `$N` vs `?` decision on the adapter so
 * compilers and manager-side SQL builders do not branch on dialect to emit
 * parameter placeholders.
 */
export interface SqlPlaceholders {
    /** Placeholder for a single parameter at the given 1-based index. */
    at(index: number): string;
    /** Comma-joined placeholder list for `count` parameters numbered starting at 1. */
    list(count: number): string;
    /**
     * Comma-joined placeholder list for `count` parameters, skipping the
     * first `startOffset` placeholder positions. Used when a statement
     * already bound some parameters before the list (for example, an
     * `UPDATE ... WHERE` clause).
     */
    listFromOffset(count: number, startOffset: number): string;
}

/**
 * Runtime adapter contract for establishing `DBClient` connections and
 * supplying dialect-specific SQL primitives (placeholders, feature flags)
 * to manager-side compilers.
 */
export interface Adapter {
    /** Stable adapter name used in configuration and registry lookup. */
    name: string;
    /**
     * Declared SQL dialect this adapter targets. Consumers branch on the
     * adapter, not on a free-standing dialect string, so dialect-awareness
     * is funnelled through the adapter interface.
     */
    dialect: Dialect;
    /** Open a database connection and return a client abstraction. */
    connect(config: AdapterConfig): Promise<DBClient>;
    /** SQL capability flags used by migrations/query orchestration. */
    features: {
        transactionalDDL: boolean;
        concurrentIndex: boolean;
        validateForeignKeys: boolean;
        ignoreDuplicateInsert: boolean;
    };
    /** Dialect-aware SQL parameter placeholder generator. */
    placeholders: SqlPlaceholders;
}
