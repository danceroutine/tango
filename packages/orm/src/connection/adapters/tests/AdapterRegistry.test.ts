import { describe, expect, it, vi } from 'vitest';
import { aDBClient } from '@danceroutine/tango-testing';
import { AdapterRegistry, connectDB, getDefaultAdapterRegistry } from '../AdapterRegistry';
import type { Adapter } from '../Adapter';

function makeAdapter(name: string): Adapter {
    return {
        name,
        features: {
            transactionalDDL: true,
            concurrentIndex: false,
            validateForeignKeys: false,
        },
        connect: vi.fn(async () => aDBClient()),
    };
}

describe(AdapterRegistry, () => {
    it('stores adapters by dialect and resolves them later', () => {
        const registry = new AdapterRegistry();
        const sqlite = makeAdapter('sqlite');
        registry.register(sqlite);

        expect(registry.has('sqlite')).toBe(true);
        expect(registry.get('sqlite')).toBe(sqlite);
        expect(AdapterRegistry.isAdapterRegistry(registry)).toBe(true);
        expect(AdapterRegistry.isAdapterRegistry({})).toBe(false);
    });

    it('throws descriptive error for unknown adapters', () => {
        const registry = new AdapterRegistry();
        expect(() => registry.get('missing')).toThrow('Unknown adapter: missing. Available adapters: none');
    });

    it('connects via explicit registry', async () => {
        const registry = new AdapterRegistry();
        const sqlite = makeAdapter('sqlite');
        registry.register(sqlite);

        const client = await connectDB({ adapter: 'sqlite', filename: ':memory:' }, registry);

        expect(client).toBeDefined();
        expect(sqlite.connect).toHaveBeenCalledWith({ adapter: 'sqlite', filename: ':memory:' });
    });

    it('provides singleton default registry with built-in adapters', async () => {
        const first = await AdapterRegistry.getDefaultRegistry();
        const second = await getDefaultAdapterRegistry();

        expect(first).toBe(second);
        expect(first.has('postgres')).toBe(true);
        expect(first.has('sqlite')).toBe(true);
    });

    it('connects via default registry when explicit registry is omitted', async () => {
        const client = await connectDB({ adapter: 'sqlite', filename: ':memory:' });
        expect(client).toBeDefined();
        await client.close();
    });
});
