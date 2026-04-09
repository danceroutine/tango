import type { DBClient } from '../../connection/index';
import type { TangoRuntime } from '../../runtime/index';
import { TransactionEngine } from '../../transaction/internal/context';

/**
 * DB client proxy that resolves either the active transaction lease or the
 * runtime autocommit path lazily.
 */
export class RuntimeBoundClient implements DBClient {
    constructor(private readonly runtime: TangoRuntime) {}

    async query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<{ rows: T[] }> {
        const lease = TransactionEngine.forRuntime(this.runtime).getActiveLease();
        if (lease) {
            return lease.client.query<T>(sql, params);
        }

        const runtimeWithQuery = this.runtime as TangoRuntime & {
            query?: <TResult = unknown>(sql: string, params?: readonly unknown[]) => Promise<{ rows: TResult[] }>;
        };
        if (typeof runtimeWithQuery.query === 'function') {
            return runtimeWithQuery.query<T>(sql, params);
        }

        const client = await this.runtime.getClient();
        return client.query<T>(sql, params);
    }

    async begin(): Promise<void> {
        throw new Error('Runtime-bound clients do not support manual begin(). Use transaction.atomic(...) instead.');
    }

    async commit(): Promise<void> {
        throw new Error('Runtime-bound clients do not support manual commit(). Use transaction.atomic(...) instead.');
    }

    async rollback(): Promise<void> {
        throw new Error('Runtime-bound clients do not support manual rollback(). Use transaction.atomic(...) instead.');
    }

    async createSavepoint(_name: string): Promise<void> {
        throw new Error(
            'Runtime-bound clients do not support manual savepoints. Use transaction.atomic(...) or tx.savepoint(...) instead.'
        );
    }

    async releaseSavepoint(_name: string): Promise<void> {
        throw new Error(
            'Runtime-bound clients do not support manual savepoint release. Use transaction.atomic(...) or tx.savepoint(...) instead.'
        );
    }

    async rollbackToSavepoint(_name: string): Promise<void> {
        throw new Error(
            'Runtime-bound clients do not support manual savepoint rollback. Use transaction.atomic(...) or tx.savepoint(...) instead.'
        );
    }

    async close(): Promise<void> {
        throw new Error('Runtime-bound clients do not support manual close(). Use TangoRuntime.reset() instead.');
    }
}
