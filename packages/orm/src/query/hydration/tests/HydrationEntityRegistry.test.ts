import { describe, expect, it, vi } from 'vitest';
import { InternalRelationHydrationLoadMode } from '../../domain/RelationMeta';
import { InternalRelationHydrationCardinality } from '../../domain/RelationTyping';
import type { CompiledHydrationNode } from '../../domain/CompiledQuery';
import { HydrationEntityRegistry } from '../HydrationEntityRegistry';

const baseNode = {
    nodeId: 'team',
    relationName: 'team',
    relationPath: 'team',
    ownerModelKey: 'tests/User',
    targetModelKey: 'tests/Team',
    loadMode: InternalRelationHydrationLoadMode.JOIN,
    cardinality: InternalRelationHydrationCardinality.SINGLE,
    sourceKey: 'team_id',
    ownerSourceAccessor: 'team_id',
    targetKey: 'id',
    targetTable: 'teams',
    targetPrimaryKey: 'id',
    targetColumns: { id: 'int', name: 'text' },
    provenance: ['team'],
    joinChildren: [],
    prefetchChildren: [],
} satisfies CompiledHydrationNode;

describe(HydrationEntityRegistry, () => {
    it('reuses records by target model and primary key', () => {
        const attachPersistedRecordAccessors = vi.fn();
        const registry = new HydrationEntityRegistry(attachPersistedRecordAccessors);

        const first = registry.canonicalize(baseNode, { id: 1, name: 'Core' });
        const second = registry.canonicalize(baseNode, { id: 1, name: 'Platform' });

        expect(second).toBe(first);
        expect(first).toEqual({ id: 1, name: 'Platform' });
        expect(attachPersistedRecordAccessors).toHaveBeenCalledOnce();
        expect(attachPersistedRecordAccessors).toHaveBeenCalledWith(first, 'tests/Team');
    });

    it('leaves records without stable primary keys uncached', () => {
        const attachPersistedRecordAccessors = vi.fn();
        const registry = new HydrationEntityRegistry(attachPersistedRecordAccessors);
        const first = { id: null, name: 'Draft' };
        const second = { id: null, name: 'Draft' };

        expect(registry.canonicalize(baseNode, first)).toBe(first);
        expect(registry.canonicalize(baseNode, second)).toBe(second);
        expect(attachPersistedRecordAccessors).not.toHaveBeenCalled();
    });

    it('narrows unknown values with a brand guard', () => {
        expect(HydrationEntityRegistry.isHydrationEntityRegistry(new HydrationEntityRegistry())).toBe(true);
        expect(HydrationEntityRegistry.isHydrationEntityRegistry({})).toBe(false);
    });
});
