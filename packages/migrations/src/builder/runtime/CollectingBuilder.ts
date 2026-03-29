import type { Builder } from '../contracts/Builder';
import type { MigrationOperation } from '../../domain/MigrationOperation';
import type { MigrationMode } from '../../domain/MigrationMode';

/**
 * In-memory builder that collects migration operations and data callbacks.
 */
export class CollectingBuilder implements Builder {
    static readonly BRAND = 'tango.migrations.collecting_builder' as const;
    readonly __tangoBrand: typeof CollectingBuilder.BRAND = CollectingBuilder.BRAND;
    ops: MigrationOperation[] = [];
    dataFns: Array<(ctx: { query(sql: string, params?: readonly unknown[]): Promise<void> }) => Promise<void>> = [];
    private mode?: MigrationMode;

    /**
     * Narrow an unknown value to the in-memory builder used during migration collection.
     */
    static isCollectingBuilder(value: unknown): value is CollectingBuilder {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === CollectingBuilder.BRAND
        );
    }

    /**
     * Append schema operations to the collection.
     */
    run(...ops: MigrationOperation[]): void {
        this.ops.push(...ops);
    }

    /**
     * Register a data migration callback.
     */
    data(fn: (ctx: { query(sql: string, params?: readonly unknown[]): Promise<void> }) => Promise<void>): void {
        this.dataFns.push(fn);
    }

    /**
     * Set execution options for the migration.
     */
    options(o: { mode?: MigrationMode }): void {
        this.mode = o.mode;
    }

    /**
     * Get the currently configured migration mode.
     */
    getMode(): MigrationMode | undefined {
        return this.mode;
    }
}
