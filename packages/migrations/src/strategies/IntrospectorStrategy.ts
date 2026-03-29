import type { DBClient, DatabaseIntrospector } from '../introspect/DatabaseIntrospector';
import type { Dialect } from '../domain/Dialect';
import { InternalDialect } from '../domain/internal/InternalDialect';
import type { DbSchema } from '../introspect/PostgresIntrospector';
import { PostgresIntrospector } from '../introspect/PostgresIntrospector';
import { SqliteIntrospector } from '../introspect/SqliteIntrospector';

type IntrospectorFactory = {
    create(): DatabaseIntrospector;
};

type IntrospectorFactoryRegistry = Record<Dialect, IntrospectorFactory>;

/**
 * Dialect-aware schema introspection orchestration.
 */
export class IntrospectorStrategy {
    static readonly BRAND = 'tango.migrations.introspector_strategy' as const;
    readonly __tangoBrand: typeof IntrospectorStrategy.BRAND = IntrospectorStrategy.BRAND;
    private readonly introspectorCache = new Map<Dialect, DatabaseIntrospector>();

    constructor(private readonly factories: IntrospectorFactoryRegistry) {}

    /**
     * Narrow an unknown value to the dialect-aware schema introspection strategy.
     */
    static isIntrospectorStrategy(value: unknown): value is IntrospectorStrategy {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === IntrospectorStrategy.BRAND
        );
    }

    /**
     * Introspect database schema using a dialect-specific introspector.
     */
    introspect(dialect: Dialect, client: DBClient): Promise<DbSchema> {
        const introspector = this.getIntrospector(dialect);
        return introspector.introspect(client);
    }

    /**
     * Resolve and cache an introspector instance for a dialect.
     */
    getIntrospector(dialect: Dialect): DatabaseIntrospector {
        const cached = this.introspectorCache.get(dialect);
        if (cached) {
            return cached;
        }

        const factory = this.factories[dialect];
        if (!factory) {
            throw new Error(`No database introspector factory registered for dialect: ${String(dialect)}`);
        }

        const introspector = factory.create();
        this.introspectorCache.set(dialect, introspector);
        return introspector;
    }
}

/**
 * Create the default introspector strategy with built-in dialect support.
 */
export function createDefaultIntrospectorStrategy(): IntrospectorStrategy {
    return new IntrospectorStrategy({
        [InternalDialect.POSTGRES]: { create: () => new PostgresIntrospector() },
        [InternalDialect.SQLITE]: { create: () => new SqliteIntrospector() },
    });
}
