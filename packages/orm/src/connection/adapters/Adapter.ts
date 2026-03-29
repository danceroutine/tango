import type { DBClient } from '../clients/DBClient';

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
 * Runtime adapter contract for establishing `DBClient` connections.
 */
export interface Adapter {
    /** Stable adapter name used in configuration and registry lookup. */
    name: string;
    /** Open a database connection and return a client abstraction. */
    connect(config: AdapterConfig): Promise<DBClient>;
    /** SQL capability flags used by migrations/query orchestration. */
    features: {
        transactionalDDL: boolean;
        concurrentIndex: boolean;
        validateForeignKeys: boolean;
    };
}
