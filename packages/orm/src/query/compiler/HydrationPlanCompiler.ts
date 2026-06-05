import { OrmSqlSafetyAdapter } from '../../validation';
import { InternalSqlValidationPlanKind as SqlPlanKind } from '../../validation/internal/InternalSqlValidationPlanKind';
import type { CompiledHydrationNode, CompiledJoinHydrationDescriptor } from '../domain/CompiledQuery';
import { InternalRelationHydrationLoadMode } from '../domain/RelationMeta';
import type { TableMeta } from '../domain/TableMeta';
import type { QueryHydrationPlanNode, QueryHydrationPlanRoot } from '../planning';

const sqlSafetyAdapter = new OrmSqlSafetyAdapter();

type JoinCollection = {
    selects: string[];
    joins: string[];
};

export type CompiledHydrationArtifacts = {
    joinNodes: CompiledHydrationNode[];
    prefetchNodes: CompiledHydrationNode[];
    hiddenRootAliases: string[];
    rootJoinSelects: string[];
    rootJoinSql: string[];
    rootHiddenSelects: string[];
};

/**
 * Compiles planned relation hydration paths into root-query join artifacts and
 * recursive hydration nodes.
 */
export class HydrationPlanCompiler {
    constructor(private readonly meta: TableMeta) {}

    compile(
        plan: QueryHydrationPlanRoot,
        options: {
            rootTable: string;
            rootSelectedFields?: readonly string[];
        }
    ): CompiledHydrationArtifacts {
        const joinCollection: JoinCollection = { selects: [], joins: [] };
        const hiddenRootAliases: string[] = [];

        const joinNodes = plan.joinNodes.map((node) =>
            this.compileHydrationNode(node, {
                rootTable: options.rootTable,
                ownerMeta: this.meta,
                ownerAlias: options.rootTable,
                collectRootJoins: true,
                rootSelectedFields: options.rootSelectedFields,
                hiddenRootAliases,
                joinCollection,
            })
        );
        const prefetchNodes = plan.prefetchNodes.map((node) =>
            this.compileHydrationNode(node, {
                rootTable: options.rootTable,
                ownerMeta: this.meta,
                ownerAlias: options.rootTable,
                collectRootJoins: false,
                rootSelectedFields: options.rootSelectedFields,
                hiddenRootAliases,
                joinCollection,
            })
        );

        return {
            joinNodes,
            prefetchNodes,
            hiddenRootAliases: [...new Set(hiddenRootAliases)],
            rootJoinSelects: joinCollection.selects,
            rootJoinSql: joinCollection.joins,
            rootHiddenSelects: this.buildRootHiddenSelects(prefetchNodes, options.rootTable),
        };
    }

    private compileHydrationNode(
        node: QueryHydrationPlanNode,
        context: {
            rootTable: string;
            ownerMeta: TableMeta;
            ownerAlias: string;
            collectRootJoins: boolean;
            rootSelectedFields?: readonly string[];
            hiddenRootAliases: string[];
            joinCollection: JoinCollection;
        }
    ): CompiledHydrationNode {
        const validatedRelation = this.validateHydrationRelation(context.ownerMeta, node.relationName);
        const targetColumns = validatedRelation.targetColumns;
        const targetMeta = node.relationEdge.targetMeta;
        if (!targetMeta) {
            throw new Error(`Relation path '${node.relationPath}' is missing target metadata.`);
        }
        const compiledJoinChildren = node.joinChildren.map((child) =>
            this.compileHydrationNode(child, {
                ...context,
                ownerMeta: targetMeta,
                ownerAlias: this.buildJoinAlias(node.relationPath),
                collectRootJoins: context.collectRootJoins,
            })
        );
        const compiledPrefetchChildren = node.prefetchChildren.map((child) =>
            this.compileHydrationNode(child, {
                ...context,
                ownerMeta: targetMeta,
                ownerAlias: this.buildJoinAlias(node.relationPath),
                collectRootJoins: false,
            })
        );

        let joinDescriptor: CompiledJoinHydrationDescriptor | undefined;
        if (node.loadMode === InternalRelationHydrationLoadMode.JOIN) {
            joinDescriptor = {
                alias: this.buildJoinAlias(node.relationPath),
                columns: Object.fromEntries(
                    Object.keys(targetColumns).map((column) => [
                        column,
                        this.buildHydrationColumnAlias(node.relationPath, column),
                    ])
                ),
            };

            if (context.collectRootJoins) {
                context.joinCollection.joins.push(
                    `LEFT JOIN ${validatedRelation.table} ${joinDescriptor.alias} ON ${joinDescriptor.alias}.${validatedRelation.targetKey} = ${context.ownerAlias}.${validatedRelation.sourceKey}`
                );
                context.joinCollection.selects.push(
                    ...Object.entries(joinDescriptor.columns).map(
                        ([column, alias]) => `${joinDescriptor!.alias}.${column} AS ${alias}`
                    )
                );
            }
        }

        const ownerSourceAccessor =
            node.loadMode === InternalRelationHydrationLoadMode.PREFETCH &&
            context.collectRootJoins === false &&
            context.ownerAlias === context.rootTable &&
            context.rootSelectedFields?.length &&
            !context.rootSelectedFields.includes(validatedRelation.sourceKey)
                ? this.buildPrefetchSourceAlias(node.relationPath, validatedRelation.sourceKey)
                : validatedRelation.sourceKey;

        if (
            node.loadMode === InternalRelationHydrationLoadMode.PREFETCH &&
            ownerSourceAccessor !== validatedRelation.sourceKey
        ) {
            context.hiddenRootAliases.push(ownerSourceAccessor);
        }

        return {
            nodeId: node.nodeId,
            relationName: node.relationName,
            relationPath: node.relationPath,
            ownerModelKey: node.ownerModelKey,
            targetModelKey: node.targetModelKey,
            loadMode: node.loadMode,
            cardinality: node.cardinality,
            sourceKey: validatedRelation.sourceKey,
            ownerSourceAccessor,
            targetKey: validatedRelation.targetKey,
            targetTable: validatedRelation.table,
            targetPrimaryKey: node.relationEdge.targetPrimaryKey,
            throughTable: node.relationEdge.throughTable,
            throughSourceKey: node.relationEdge.throughSourceKey,
            throughTargetKey: node.relationEdge.throughTargetKey,
            throughSourceColumnType: node.relationEdge.throughSourceColumnType,
            throughTargetColumnType: node.relationEdge.throughTargetColumnType,
            targetColumns,
            provenance: node.provenance,
            joinChildren: compiledJoinChildren,
            prefetchChildren: compiledPrefetchChildren,
            join: joinDescriptor,
        };
    }

    private validateHydrationRelation(
        ownerMeta: TableMeta,
        relationName: string
    ): NonNullable<TableMeta['relations']>[string] {
        return sqlSafetyAdapter.validate({
            kind: SqlPlanKind.SELECT,
            meta: ownerMeta,
            relationNames: [relationName],
        }).relations[relationName]!;
    }

    private buildRootHiddenSelects(nodes: readonly CompiledHydrationNode[], table: string): string[] {
        return nodes.flatMap((node) => {
            const select =
                node.ownerSourceAccessor === node.sourceKey
                    ? []
                    : [`${table}.${node.sourceKey} AS ${node.ownerSourceAccessor}`];
            return [...select, ...this.buildRootHiddenSelects(node.prefetchChildren, table)];
        });
    }

    private buildJoinAlias(relationPath: string): string {
        return this.assertInternalAliasDoesNotCollide(`__tango_join_${this.sanitizeRelationPath(relationPath)}`);
    }

    private buildHydrationColumnAlias(relationPath: string, column: string): string {
        return this.assertInternalAliasDoesNotCollide(
            `__tango_hydrate_${this.sanitizeRelationPath(relationPath)}_${column}`
        );
    }

    private buildPrefetchSourceAlias(relationPath: string, sourceKey: string): string {
        return this.assertInternalAliasDoesNotCollide(
            `__tango_prefetch_${this.sanitizeRelationPath(relationPath)}_${sourceKey}`
        );
    }

    private sanitizeRelationPath(relationPath: string): string {
        return relationPath.replace(/[^a-zA-Z0-9]+/gu, '_');
    }

    private assertInternalAliasDoesNotCollide(alias: string): string {
        if (alias in this.meta.columns) {
            throw new Error(`Internal query alias '${alias}' collides with a field on table '${this.meta.table}'.`);
        }
        return alias;
    }
}
