import type { AdapterConfig } from '../../connection/adapters/Adapter';
import type { DBClientProvider } from './DBClientProvider';
import { PostgresDBClientProvider } from './PostgresDBClientProvider';
import { SqliteDBClientProvider } from './SqliteDBClientProvider';

export function createDBClientProvider(config: AdapterConfig & { adapter: string }): DBClientProvider {
    switch (config.adapter) {
        case 'postgres':
            return new PostgresDBClientProvider(config);
        case 'sqlite':
            return new SqliteDBClientProvider(config);
        default:
            throw new Error(`Unsupported adapter for Tango runtime provider: ${config.adapter}`);
    }
}
