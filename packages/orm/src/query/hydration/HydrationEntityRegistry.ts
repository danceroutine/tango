import type { CompiledHydrationNode } from '../domain/CompiledQuery';

type AccessorAttachment = (record: Record<string, unknown>, modelKey?: string) => void;

/**
 * Tracks hydrated related records so repeated rows point at one canonical
 * object per model primary key.
 */
export class HydrationEntityRegistry {
    static readonly BRAND = 'tango.orm.hydration_entity_registry' as const;
    readonly __tangoBrand: typeof HydrationEntityRegistry.BRAND = HydrationEntityRegistry.BRAND;

    private readonly recordsByModel = new Map<string, Map<string | number, Record<string, unknown>>>();

    constructor(private readonly attachPersistedRecordAccessors?: AccessorAttachment) {}

    static isHydrationEntityRegistry(value: unknown): value is HydrationEntityRegistry {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === HydrationEntityRegistry.BRAND
        );
    }

    canonicalize(node: CompiledHydrationNode, row: Record<string, unknown>): Record<string, unknown> {
        // Mixed join/prefetch traversal can encounter the same related row more
        // than once. Canonicalization ensures all later descendants attach to
        // one stable object graph instead of competing copies.
        const primaryKeyValue = row[node.targetPrimaryKey];
        if (typeof primaryKeyValue !== 'string' && typeof primaryKeyValue !== 'number') {
            return row;
        }

        const byModel =
            this.recordsByModel.get(node.targetModelKey) ?? new Map<string | number, Record<string, unknown>>();
        const existing = byModel.get(primaryKeyValue);
        if (existing) {
            Object.assign(existing, row);
            return existing;
        }

        byModel.set(primaryKeyValue, row);
        this.recordsByModel.set(node.targetModelKey, byModel);
        this.attachPersistedRecordAccessors?.(row, node.targetModelKey);
        return row;
    }
}
