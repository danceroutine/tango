import { describe, expect, it, vi } from 'vitest';
import { aTangoConfig } from '@danceroutine/tango-testing';
import { loadConfig } from '@danceroutine/tango-config';

const provider = {
    query: vi.fn(async () => ({ rows: [{ id: 1 }] })),
    leaseTransactionClient: vi.fn(async () => ({ client: {} as never, release: vi.fn(async () => {}) })),
    reset: vi.fn(async () => {}),
};

vi.mock('../internal/createDBClientProvider', () => ({
    createDBClientProvider: vi.fn(() => provider),
}));

import { TangoRuntime } from '../TangoRuntime';

describe('TangoRuntime provider wiring', () => {
    it('delegates autocommit queries, transaction leasing, and reset through the cached provider', async () => {
        const runtime = new TangoRuntime(() => loadConfig(() => aTangoConfig()));

        await expect(runtime.query('SELECT 1')).resolves.toEqual({ rows: [{ id: 1 }] });
        const lease = await runtime.leaseTransactionClient();
        expect(lease.client).toBeDefined();
        await runtime.reset();

        expect(provider.query).toHaveBeenCalledWith('SELECT 1', undefined);
        expect(provider.leaseTransactionClient).toHaveBeenCalledOnce();
        expect(provider.reset).toHaveBeenCalledOnce();
    });
});
