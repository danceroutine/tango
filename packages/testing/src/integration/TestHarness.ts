import { HarnessStrategyRegistry } from './HarnessStrategyRegistry';
import { Dialect, type HarnessOptions, type HarnessStrategy, type IntegrationHarness } from './domain';
import { PostgresHarnessStrategy } from './strategies/PostgresHarnessStrategy';
import { SqliteHarnessStrategy } from './strategies/SqliteHarnessStrategy';

/**
 * Facade for creating integration test harnesses by dialect.
 */
export class TestHarness {
    static readonly BRAND = 'tango.testing.test_harness' as const;
    private static defaultRegistry: HarnessStrategyRegistry | null = null;
    readonly __tangoBrand: typeof TestHarness.BRAND = TestHarness.BRAND;

    /**
     * Narrow an unknown value to `TestHarness`.
     */
    static isTestHarness(value: unknown): value is TestHarness {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === TestHarness.BRAND
        );
    }

    /**
     * Register a harness strategy on the shared default registry.
     */
    static registerStrategy(strategy: HarnessStrategy): void {
        this.ensureRegistry().register(strategy);
    }

    /**
     * Return the shared harness strategy registry.
     */
    static getRegistry(): HarnessStrategyRegistry {
        return this.ensureRegistry();
    }

    /**
     * Create a dialect-specific harness from the registry.
     */
    static async forDialect(
        args: { dialect: Dialect | string; options?: HarnessOptions },
        registry?: HarnessStrategyRegistry
    ): Promise<IntegrationHarness> {
        const selectedRegistry = registry ?? this.ensureRegistry();
        const strategy = selectedRegistry.get(args.dialect);
        return strategy.create(args.options);
    }

    /**
     * Convenience helper for a SQLite test harness.
     */
    static async sqlite(options?: HarnessOptions): Promise<IntegrationHarness> {
        return this.forDialect({ dialect: Dialect.Sqlite, options });
    }

    /**
     * Convenience helper for a Postgres test harness.
     */
    static async postgres(options?: HarnessOptions): Promise<IntegrationHarness> {
        return this.forDialect({ dialect: Dialect.Postgres, options });
    }

    private static ensureRegistry(): HarnessStrategyRegistry {
        if (this.defaultRegistry) return this.defaultRegistry;

        const registry = new HarnessStrategyRegistry();
        registry.register(new SqliteHarnessStrategy());
        registry.register(new PostgresHarnessStrategy());
        this.defaultRegistry = registry;
        return registry;
    }
}
