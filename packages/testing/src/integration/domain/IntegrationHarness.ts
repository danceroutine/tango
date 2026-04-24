import type { Adapter, DBClient } from '@danceroutine/tango-orm';
import type { MigrationRunner } from '@danceroutine/tango-migrations';
import type { Dialect } from './Dialect';
import type { ResetMode } from './ResetMode';

export interface DialectTestCapabilities {
    transactionalDDL: boolean;
    supportsSchemas: boolean;
    supportsConcurrentIndex: boolean;
    supportsDeferredFkValidation: boolean;
    supportsJsonb: boolean;
}

export interface IntegrationHarness {
    readonly dialect: Dialect | string;
    readonly adapter: Adapter;
    readonly capabilities: DialectTestCapabilities;
    readonly resetMode: ResetMode;
    readonly dbClient: DBClient;
    setup(): Promise<void>;
    reset(): Promise<void>;
    teardown(): Promise<void>;
    migrationRunner(migrationsDir: string): MigrationRunner;
}
