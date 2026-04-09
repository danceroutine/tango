import { describe, expect, it, vi } from 'vitest';
import { aDBClient } from '@danceroutine/tango-testing';

const runtime = {
    leaseTransactionClient: vi.fn(async () => ({ client: aDBClient(), release: vi.fn(async () => {}) })),
};

vi.mock('../../runtime/defaultRuntime', () => ({
    getTangoRuntime: vi.fn(() => runtime),
}));

import { atomic } from '../atomic';

describe('public transaction.atomic', () => {
    it('binds the package-level API to the default runtime', async () => {
        await expect(atomic(async () => 'ok')).resolves.toBe('ok');
        expect(runtime.leaseTransactionClient).toHaveBeenCalledOnce();
    });
});
