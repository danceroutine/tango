import type { Adapter, AdapterConfig } from './Adapter';
import type { DBClient } from '../clients/DBClient';

/**
 * Runtime registry for database adapters.
 *
 * Use a custom instance when tests or applications need explicit control
 * over supported adapters; use `getDefaultRegistry()` for the built-in set.
 */
export class AdapterRegistry {
    static readonly BRAND = 'tango.orm.adapter_registry' as const;
    private static defaultRegistryInstance: AdapterRegistry | undefined;
    readonly __tangoBrand: typeof AdapterRegistry.BRAND = AdapterRegistry.BRAND;
    private adapters = new Map<string, Adapter>();

    /**
     * Narrow an unknown value to `AdapterRegistry`.
     */
    static isAdapterRegistry(value: unknown): value is AdapterRegistry {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === AdapterRegistry.BRAND
        );
    }

    /**
     * Return a lazily-initialized registry preloaded with built-in adapters.
     */
    static async getDefaultRegistry(): Promise<AdapterRegistry> {
        if (AdapterRegistry.defaultRegistryInstance) {
            return AdapterRegistry.defaultRegistryInstance;
        }

        AdapterRegistry.defaultRegistryInstance = new AdapterRegistry();

        const { PostgresAdapter } = await import('./dialects/PostgresAdapter');
        const { SqliteAdapter } = await import('./dialects/SqliteAdapter');

        AdapterRegistry.defaultRegistryInstance.register(new PostgresAdapter());
        AdapterRegistry.defaultRegistryInstance.register(new SqliteAdapter());

        return AdapterRegistry.defaultRegistryInstance;
    }

    /**
     * Register an adapter under its declared `name`.
     */
    register(adapter: Adapter): this {
        this.adapters.set(adapter.name, adapter);
        return this;
    }

    /**
     * Resolve an adapter by name, or throw a descriptive error.
     */
    get(name: string): Adapter {
        const adapter = this.adapters.get(name);
        if (!adapter) {
            const available = [...this.adapters.keys()].join(', ');
            throw new Error(`Unknown adapter: ${name}. Available adapters: ${available || 'none'}`);
        }
        return adapter;
    }

    /**
     * Check whether an adapter has been registered.
     */
    has(name: string): boolean {
        return this.adapters.has(name);
    }
}

/**
 * Connect to a database by adapter name using the provided (or default) registry.
 */
export async function connectDB(
    config: AdapterConfig & { adapter: string },
    registry?: AdapterRegistry
): Promise<DBClient> {
    const effectiveRegistry = registry ?? (await AdapterRegistry.getDefaultRegistry());
    const adapter = effectiveRegistry.get(config.adapter);
    return adapter.connect(config);
}

/**
 * Convenience helper that exposes the singleton default adapter registry.
 */
export async function getDefaultAdapterRegistry(): Promise<AdapterRegistry> {
    return AdapterRegistry.getDefaultRegistry();
}
