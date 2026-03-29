import { FrameworkScaffoldStrategy, type SupportedFramework } from '../contracts/FrameworkScaffoldStrategy';
import { ExpressScaffoldStrategy } from '../strategies/express/ExpressScaffoldStrategy';
import { NextScaffoldStrategy } from '../strategies/next/NextScaffoldStrategy';

/**
 * Registry for framework scaffolding strategies keyed by framework id.
 */
export class FrameworkScaffoldRegistry {
    private readonly strategies = new Map<SupportedFramework, FrameworkScaffoldStrategy>();

    /**
     * Create a registry preloaded with Tango's built-in framework scaffolds.
     */
    static createDefault(): FrameworkScaffoldRegistry {
        const registry = new FrameworkScaffoldRegistry();
        registry.register(new ExpressScaffoldStrategy());
        registry.register(new NextScaffoldStrategy());
        return registry;
    }

    /**
     * Register a strategy under its declared framework id.
     */
    register(strategy: FrameworkScaffoldStrategy): void {
        const existing = this.strategies.get(strategy.id);
        if (existing) {
            throw new Error(`Framework scaffold strategy '${strategy.id}' is already registered.`);
        }
        this.strategies.set(strategy.id, strategy);
    }

    /**
     * Resolve a strategy for a known framework id.
     */
    get(id: SupportedFramework): FrameworkScaffoldStrategy | undefined {
        return this.strategies.get(id);
    }

    /**
     * List all registered framework strategies in registration order.
     */
    list(): readonly FrameworkScaffoldStrategy[] {
        return [...this.strategies.values()];
    }
}
