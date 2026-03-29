import { vi } from 'vitest';
import type { DBClient } from './DBClient';

/**
 * Looser override type for `aDBClient` that accepts concrete-typed query mocks.
 * Consumers should not need to cast their mocks to satisfy `DBClient['query']`'s generic.
 */
type DBClientOverrides = {
    // oxlint-disable-next-line typescript/no-explicit-any
    query?: (sql: string, params?: readonly unknown[]) => Promise<{ rows: any[] }>;
    begin?: () => Promise<void>;
    commit?: () => Promise<void>;
    rollback?: () => Promise<void>;
    close?: () => Promise<void>;
};

/**
 * Create a lightweight `DBClient` test double with optional behavior overrides.
 * The `query` override accepts any function returning `Promise<{ rows: any[] }>`,
 * so concrete-typed Vitest mocks do not require a cast at the call site.
 */
export function aDBClient(overrides: DBClientOverrides = {}): DBClient {
    const queryImpl =
        // oxlint-disable-next-line typescript/no-explicit-any
        overrides.query ?? (async (_sql: string, _params?: readonly unknown[]) => ({ rows: [] as any[] }));
    const beginImpl = overrides.begin ?? (async () => {});
    const commitImpl = overrides.commit ?? (async () => {});
    const rollbackImpl = overrides.rollback ?? (async () => {});
    const closeImpl = overrides.close ?? (async () => {});

    return {
        query: vi.fn((sql: string, params?: readonly unknown[]) => queryImpl(sql, params)) as DBClient['query'],
        begin: vi.fn(() => beginImpl()),
        commit: vi.fn(() => commitImpl()),
        rollback: vi.fn(() => rollbackImpl()),
        close: vi.fn(() => closeImpl()),
    };
}
