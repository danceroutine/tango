import { describe, expect, it } from 'vitest';
import { aRelationMeta } from '@danceroutine/tango-testing';
import type { TableMeta } from '../../domain/TableMeta';
import { InternalRelationKind } from '../../domain/internal/InternalRelationKind';
import { QueryPlanner } from '../QueryPlanner';

const baseMeta: TableMeta = {
    table: 'users',
    pk: 'id',
    columns: {
        id: 'int',
        team: 'text',
    },
};

describe(QueryPlanner, () => {
    it('identifies matching planner instances', () => {
        const planner = new QueryPlanner(baseMeta);

        expect(QueryPlanner.isQueryPlanner(planner)).toBe(true);
        expect(QueryPlanner.isQueryPlanner({})).toBe(false);
    });

    it('rejects unknown relation paths and empty segments', () => {
        const planner = new QueryPlanner(baseMeta);

        expect(() => planner.plan({ selectRelated: ['missing'] })).toThrow(/unknown relation path/i);
        expect(() => planner.plan({ selectRelated: ['__'] })).toThrow(/invalid empty relation path/i);
    });

    it('rejects non-hydratable, non-prefetchable, and missing-target relations', () => {
        const planner = new QueryPlanner({
            ...baseMeta,
            relations: {
                tags: aRelationMeta({
                    kind: InternalRelationKind.MANY_TO_MANY,
                    table: 'tags',
                    alias: 'tags',
                    sourceKey: 'id',
                    targetKey: 'id',
                    targetColumns: { id: 'int' },
                    capabilities: {
                        hydratable: false,
                        joinable: false,
                        prefetchable: false,
                    },
                }),
                disabledTeam: aRelationMeta({
                    kind: InternalRelationKind.BELONGS_TO,
                    table: 'teams',
                    alias: 'disabled_team',
                    sourceKey: 'id',
                    targetKey: 'id',
                    targetColumns: { id: 'int' },
                    capabilities: {
                        hydratable: false,
                        joinable: false,
                        prefetchable: false,
                    },
                }),
                archivedPosts: aRelationMeta({
                    kind: InternalRelationKind.HAS_MANY,
                    table: 'posts',
                    alias: 'archived_posts',
                    sourceKey: 'id',
                    targetKey: 'author_id',
                    targetColumns: { id: 'int', author_id: 'int' },
                    capabilities: {
                        prefetchable: false,
                    },
                }),
                profile: aRelationMeta({
                    kind: InternalRelationKind.HAS_ONE,
                    table: 'profiles',
                    alias: 'profile',
                    sourceKey: 'id',
                    targetKey: 'user_id',
                    targetColumns: { id: 'int', user_id: 'int' },
                    capabilities: {
                        joinable: false,
                    },
                }),
                ghost: {
                    ...aRelationMeta({
                        kind: InternalRelationKind.BELONGS_TO,
                        table: 'ghosts',
                        alias: 'ghost',
                        sourceKey: 'id',
                        targetKey: 'id',
                        targetColumns: { id: 'int' },
                    }),
                    targetMeta: undefined,
                },
            },
        });

        expect(() => planner.plan({ prefetchRelated: ['tags'] })).toThrow(/many-to-many/i);
        expect(() => planner.plan({ selectRelated: ['disabledTeam'] })).toThrow(/cannot be hydrated/i);
        expect(() => planner.plan({ prefetchRelated: ['archivedPosts'] })).toThrow(/prefetchRelated/i);
        expect(() => planner.plan({ prefetchRelated: ['profile'] })).toThrow(/prefetchRelated/i);
        expect(() => planner.plan({ selectRelated: ['ghost'] })).toThrow(/missing target metadata/i);
    });

    it('rejects relation names that collide with unrelated base columns', () => {
        const planner = new QueryPlanner({
            ...baseMeta,
            relations: {
                team: aRelationMeta({
                    kind: InternalRelationKind.BELONGS_TO,
                    table: 'teams',
                    alias: 'team',
                    sourceKey: 'id',
                    targetKey: 'id',
                    targetColumns: { id: 'int' },
                }),
            },
        });

        expect(() => planner.plan({ selectRelated: ['team'] })).toThrow(/collides with an existing field/i);
    });
});
