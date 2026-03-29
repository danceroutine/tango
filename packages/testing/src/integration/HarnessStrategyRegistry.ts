import type { Dialect, HarnessStrategy } from './domain';

/**
 * Registry of test harness strategies keyed by dialect.
 */
export class HarnessStrategyRegistry {
    static readonly BRAND = 'tango.testing.harness_strategy_registry' as const;
    readonly __tangoBrand: typeof HarnessStrategyRegistry.BRAND = HarnessStrategyRegistry.BRAND;
    private readonly strategies = new Map<string, HarnessStrategy>();

    /**
     * Narrow an unknown value to `HarnessStrategyRegistry`.
     */
    static isHarnessStrategyRegistry(value: unknown): value is HarnessStrategyRegistry {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === HarnessStrategyRegistry.BRAND
        );
    }

    /**
     * Register or replace a dialect strategy.
     */
    register(strategy: HarnessStrategy): this {
        this.strategies.set(String(strategy.dialect), strategy);
        return this;
    }

    /**
     * Resolve a strategy for a dialect, or throw if none is registered.
     */
    get(dialect: Dialect | string): HarnessStrategy {
        const strategy = this.strategies.get(String(dialect));
        if (!strategy) {
            throw new Error(`No harness strategy registered for dialect: ${String(dialect)}`);
        }
        return strategy;
    }

    /**
     * List all registered strategies.
     */
    list(): readonly HarnessStrategy[] {
        return [...this.strategies.values()];
    }
}
