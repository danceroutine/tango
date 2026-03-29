import type { DBClient } from '../../connection/index';
import type { TangoRuntime } from '../../runtime/index';

/**
 * DB client proxy that resolves the real Tango runtime client lazily.
 */
export class RuntimeBoundClient implements DBClient {
    constructor(private readonly runtime: TangoRuntime) {}

    async query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<{ rows: T[] }> {
        const client = await this.runtime.getClient();
        return client.query<T>(sql, params);
    }

    async begin(): Promise<void> {
        const client = await this.runtime.getClient();
        await client.begin();
    }

    async commit(): Promise<void> {
        const client = await this.runtime.getClient();
        await client.commit();
    }

    async rollback(): Promise<void> {
        const client = await this.runtime.getClient();
        await client.rollback();
    }

    async close(): Promise<void> {
        const client = await this.runtime.getClient();
        await client.close();
    }
}
