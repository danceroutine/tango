import { describe, expect, it, vi } from 'vitest';
import { aDBClient } from '@danceroutine/tango-testing';
import type { TangoRuntime } from '../../../runtime';
import { TransactionEngine } from '../../../transaction/internal/context';
import { RuntimeBoundClient } from '../RuntimeBoundClient';

describe(RuntimeBoundClient, () => {
    it('delegates queries through the runtime autocommit path', async () => {
        const runtime = {
            query: vi.fn(async () => ({ rows: [{ id: 1 }] })),
            getClient: vi.fn(),
        } as unknown as TangoRuntime;

        const boundClient = new RuntimeBoundClient(runtime);
        await expect(boundClient.query('SELECT 1', [1])).resolves.toEqual({ rows: [{ id: 1 }] });

        expect(runtime.query).toHaveBeenCalledWith('SELECT 1', [1]);
    });

    it('falls back to a mocked runtime client in older test doubles', async () => {
        const client = aDBClient({
            query: vi.fn(async () => ({ rows: [{ ok: true }] })),
        });
        const runtime = {
            getClient: vi.fn(async () => client),
        } as unknown as TangoRuntime;

        const boundClient = new RuntimeBoundClient(runtime);
        await expect(boundClient.query('SELECT 1')).resolves.toEqual({ rows: [{ ok: true }] });
        expect(runtime.getClient).toHaveBeenCalledOnce();
    });

    it('rejects manual transaction control on the runtime-bound facade', async () => {
        const runtime = { query: vi.fn(async () => ({ rows: [] })), getClient: vi.fn() } as unknown as TangoRuntime;
        const boundClient = new RuntimeBoundClient(runtime);

        await expect(boundClient.begin()).rejects.toThrow(/transaction\.atomic/);
        await expect(boundClient.commit()).rejects.toThrow(/transaction\.atomic/);
        await expect(boundClient.rollback()).rejects.toThrow(/transaction\.atomic/);
        await expect(boundClient.createSavepoint('sp')).rejects.toThrow(/tx\.savepoint/);
        await expect(boundClient.releaseSavepoint('sp')).rejects.toThrow(/tx\.savepoint/);
        await expect(boundClient.rollbackToSavepoint('sp')).rejects.toThrow(/tx\.savepoint/);
        await expect(boundClient.close()).rejects.toThrow(/TangoRuntime\.reset/);
    });

    it('routes queries through the active transaction lease for the matching runtime', async () => {
        const leasedClient = aDBClient({
            query: vi.fn(async () => ({ rows: [{ via: 'lease' }] })),
        });
        const release = vi.fn(async () => {});
        const runtime = {
            query: vi.fn(async () => ({ rows: [{ via: 'runtime' }] })),
            getClient: vi.fn(),
            leaseTransactionClient: vi.fn(async () => ({ client: leasedClient, release })),
        } as unknown as TangoRuntime;

        const boundClient = new RuntimeBoundClient(runtime);
        await expect(
            TransactionEngine.forRuntime(runtime).atomic(async () => boundClient.query('SELECT 1'))
        ).resolves.toEqual({
            rows: [{ via: 'lease' }],
        });

        expect(leasedClient.query).toHaveBeenCalledWith('SELECT 1', undefined);
        expect(runtime.query).not.toHaveBeenCalled();
        expect(release).toHaveBeenCalledOnce();
    });
});
