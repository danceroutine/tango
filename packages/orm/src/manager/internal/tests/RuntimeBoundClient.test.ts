import { describe, expect, it, vi } from 'vitest';
import { aDBClient } from '@danceroutine/tango-testing';
import type { TangoRuntime } from '../../../runtime';
import { RuntimeBoundClient } from '../RuntimeBoundClient';

describe(RuntimeBoundClient, () => {
    it('delegates every operation through the runtime client', async () => {
        const client = aDBClient();
        const runtime = {
            getClient: vi.fn(async () => client),
        } as unknown as TangoRuntime;

        const boundClient = new RuntimeBoundClient(runtime);

        await boundClient.query('SELECT 1', [1]);
        await boundClient.begin();
        await boundClient.commit();
        await boundClient.rollback();
        await boundClient.close();

        expect(runtime.getClient).toHaveBeenCalledTimes(5);
        expect(client.query).toHaveBeenCalledWith('SELECT 1', [1]);
        expect(client.begin).toHaveBeenCalled();
        expect(client.commit).toHaveBeenCalled();
        expect(client.rollback).toHaveBeenCalled();
        expect(client.close).toHaveBeenCalled();
    });
});
