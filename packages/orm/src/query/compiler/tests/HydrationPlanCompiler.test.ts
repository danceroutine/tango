import { describe, expect, it } from 'vitest';
import { aRelationMeta } from '@danceroutine/tango-testing';
import { HydrationPlanCompiler } from '../HydrationPlanCompiler';
import { InternalRelationKind } from '../../domain/internal/InternalRelationKind';
import { InternalRelationHydrationLoadMode } from '../../domain/RelationMeta';
import type { TableMeta } from '../../domain/TableMeta';
import type { QueryHydrationPlanNode, QueryHydrationPlanRoot } from '../../planning';

const mockMeta: TableMeta = {
    table: 'users',
    pk: 'id',
    columns: {
        id: 'int',
        organization_id: 'int',
        email: 'text',
        name: 'text',
    },
};

function aHydrationNode(overrides: Partial<QueryHydrationPlanNode> = {}): QueryHydrationPlanNode {
    const relationEdge = aRelationMeta({
        kind: InternalRelationKind.BELONGS_TO,
        table: 'organizations',
        alias: 'organization',
        sourceKey: 'organization_id',
        targetKey: 'id',
        targetColumns: { id: 'int', name: 'text' },
    });

    return {
        nodeId: 'organization',
        relationName: 'organization',
        relationPath: 'organization',
        ownerModelKey: 'tests/User',
        relationEdge,
        targetModelKey: 'tests/Organization',
        loadMode: InternalRelationHydrationLoadMode.JOIN,
        cardinality: relationEdge.cardinality,
        provenance: ['organization'],
        joinChildren: [],
        prefetchChildren: [],
        ...overrides,
    };
}

function aHydrationPlan(overrides: Partial<QueryHydrationPlanRoot> = {}): QueryHydrationPlanRoot {
    return {
        joinNodes: [],
        prefetchNodes: [],
        requestedPaths: [],
        ...overrides,
    };
}

describe(HydrationPlanCompiler, () => {
    it('prepares root join hydration for selected relation paths', () => {
        const organizationRelation = aRelationMeta({
            kind: InternalRelationKind.BELONGS_TO,
            table: 'organizations',
            alias: 'organization',
            sourceKey: 'organization_id',
            targetKey: 'id',
            targetColumns: { id: 'int', name: 'text' },
        });
        const compiler = new HydrationPlanCompiler({
            ...mockMeta,
            relations: {
                organization: organizationRelation,
            },
        });

        const compiled = compiler.compile(
            aHydrationPlan({
                joinNodes: [
                    aHydrationNode({
                        relationEdge: organizationRelation,
                    }),
                ],
                requestedPaths: ['organization'],
            }),
            { rootTable: 'users' }
        );

        expect(compiled.rootJoinSql).toEqual([
            'LEFT JOIN organizations __tango_join_organization ON __tango_join_organization.id = users.organization_id',
        ]);
        expect(compiled.rootJoinSelects).toEqual([
            '__tango_join_organization.id AS __tango_hydrate_organization_id',
            '__tango_join_organization.name AS __tango_hydrate_organization_name',
        ]);
        expect(compiled.joinNodes[0]?.join).toEqual({
            alias: '__tango_join_organization',
            columns: {
                id: '__tango_hydrate_organization_id',
                name: '__tango_hydrate_organization_name',
            },
        });
        expect(compiled.prefetchNodes).toEqual([]);
    });

    it('adds hidden root selections when projected prefetch source fields are missing', () => {
        const postsRelation = aRelationMeta({
            kind: InternalRelationKind.HAS_MANY,
            table: 'posts',
            alias: 'posts',
            sourceKey: 'organization_id',
            targetKey: 'organization_id',
            targetColumns: { id: 'int', organization_id: 'int', title: 'text' },
        });
        const compiler = new HydrationPlanCompiler({
            ...mockMeta,
            relations: {
                posts: postsRelation,
            },
        });

        const compiled = compiler.compile(
            aHydrationPlan({
                prefetchNodes: [
                    aHydrationNode({
                        nodeId: 'posts',
                        relationName: 'posts',
                        relationPath: 'posts',
                        relationEdge: postsRelation,
                        targetModelKey: 'tests/Post',
                        loadMode: InternalRelationHydrationLoadMode.PREFETCH,
                        cardinality: postsRelation.cardinality,
                        provenance: ['posts'],
                    }),
                ],
                requestedPaths: ['posts'],
            }),
            { rootTable: 'users', rootSelectedFields: ['id'] }
        );

        expect(compiled.hiddenRootAliases).toEqual(['__tango_prefetch_posts_organization_id']);
        expect(compiled.rootHiddenSelects).toEqual(['users.organization_id AS __tango_prefetch_posts_organization_id']);
        expect(compiled.prefetchNodes[0]?.ownerSourceAccessor).toBe('__tango_prefetch_posts_organization_id');
    });

    it('uses selected root fields directly for prefetch source accessors', () => {
        const postsRelation = aRelationMeta({
            kind: InternalRelationKind.HAS_MANY,
            table: 'posts',
            alias: 'posts',
            sourceKey: 'organization_id',
            targetKey: 'organization_id',
            targetColumns: { id: 'int', organization_id: 'int', title: 'text' },
        });
        const compiler = new HydrationPlanCompiler({
            ...mockMeta,
            relations: {
                posts: postsRelation,
            },
        });

        const compiled = compiler.compile(
            aHydrationPlan({
                prefetchNodes: [
                    aHydrationNode({
                        nodeId: 'posts',
                        relationName: 'posts',
                        relationPath: 'posts',
                        relationEdge: postsRelation,
                        targetModelKey: 'tests/Post',
                        loadMode: InternalRelationHydrationLoadMode.PREFETCH,
                        cardinality: postsRelation.cardinality,
                        provenance: ['posts'],
                    }),
                ],
                requestedPaths: ['posts'],
            }),
            { rootTable: 'users', rootSelectedFields: ['organization_id'] }
        );

        expect(compiled.hiddenRootAliases).toEqual([]);
        expect(compiled.rootHiddenSelects).toEqual([]);
        expect(compiled.prefetchNodes[0]?.ownerSourceAccessor).toBe('organization_id');
    });

    it('prepares nested prefetch descendants under join hydration paths', () => {
        const postsRelation = aRelationMeta({
            kind: InternalRelationKind.HAS_MANY,
            table: 'posts',
            alias: 'posts',
            sourceKey: 'id',
            targetKey: 'organization_id',
            targetColumns: { id: 'int', organization_id: 'int', title: 'text' },
        });
        const organizationRelation = aRelationMeta({
            kind: InternalRelationKind.BELONGS_TO,
            table: 'organizations',
            alias: 'organization',
            sourceKey: 'organization_id',
            targetKey: 'id',
            targetColumns: { id: 'int', name: 'text' },
            targetMeta: {
                table: 'organizations',
                pk: 'id',
                columns: { id: 'int', name: 'text' },
                relations: {
                    posts: postsRelation,
                },
            },
        });
        const compiler = new HydrationPlanCompiler({
            ...mockMeta,
            relations: {
                organization: organizationRelation,
            },
        });

        const compiled = compiler.compile(
            aHydrationPlan({
                joinNodes: [
                    aHydrationNode({
                        relationEdge: organizationRelation,
                        prefetchChildren: [
                            aHydrationNode({
                                nodeId: 'organization__posts',
                                relationName: 'posts',
                                relationPath: 'organization__posts',
                                relationEdge: postsRelation,
                                targetModelKey: 'tests/Post',
                                loadMode: InternalRelationHydrationLoadMode.PREFETCH,
                                cardinality: postsRelation.cardinality,
                                provenance: ['organization__posts'],
                            }),
                        ],
                    }),
                ],
                requestedPaths: ['organization__posts'],
            }),
            { rootTable: 'users' }
        );

        const posts = compiled.joinNodes[0]?.prefetchChildren[0];
        expect(posts?.relationPath).toBe('organization__posts');
        expect(posts?.ownerSourceAccessor).toBe('id');
        expect(compiled.rootHiddenSelects).toEqual([]);
    });

    it('rejects relation paths that no longer carry target metadata', () => {
        const organizationRelation = aRelationMeta({
            kind: InternalRelationKind.BELONGS_TO,
            table: 'organizations',
            alias: 'organization',
            sourceKey: 'organization_id',
            targetKey: 'id',
            targetColumns: { id: 'int' },
        });
        const compiler = new HydrationPlanCompiler({
            ...mockMeta,
            relations: {
                organization: organizationRelation,
            },
        });

        expect(() =>
            compiler.compile(
                aHydrationPlan({
                    joinNodes: [
                        aHydrationNode({
                            relationEdge: {
                                ...organizationRelation,
                                targetMeta: undefined,
                            },
                        }),
                    ],
                    requestedPaths: ['organization'],
                }),
                { rootTable: 'users' }
            )
        ).toThrow(/missing target metadata/iu);
    });

    it('rejects internal hydration aliases that collide with model fields', () => {
        const organizationRelation = aRelationMeta({
            kind: InternalRelationKind.BELONGS_TO,
            table: 'organizations',
            alias: 'organization',
            sourceKey: 'organization_id',
            targetKey: 'id',
            targetColumns: { id: 'int' },
        });
        const compiler = new HydrationPlanCompiler({
            ...mockMeta,
            columns: {
                ...mockMeta.columns,
                __tango_hydrate_organization_id: 'text',
            },
            relations: {
                organization: organizationRelation,
            },
        });

        expect(() =>
            compiler.compile(
                aHydrationPlan({
                    joinNodes: [
                        aHydrationNode({
                            relationEdge: organizationRelation,
                        }),
                    ],
                    requestedPaths: ['organization'],
                }),
                { rootTable: 'users' }
            )
        ).toThrow(/internal query alias/iu);
    });
});
