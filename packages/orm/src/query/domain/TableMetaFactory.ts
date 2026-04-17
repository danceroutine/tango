import { ModelRegistry } from '@danceroutine/tango-schema';
import type { Model as SchemaModel } from '@danceroutine/tango-schema/domain';
import type { TableMeta } from './TableMeta';
import type { RelationMeta } from './RelationMeta';
import { InternalRelationKind } from './internal/InternalRelationKind';

type ModelMetadataLike = Omit<SchemaModel['metadata'], 'key' | 'namespace' | 'fields'> & {
    key?: string;
    namespace?: string;
    fields: Array<{
        name: string;
        type: string;
        primaryKey?: boolean;
    }>;
};

type TableMetaModel = {
    metadata: ModelMetadataLike;
};

/**
 * Build registry-backed recursive table metadata for query planning and
 * hydration execution.
 */
export class TableMetaFactory {
    static create(model: TableMetaModel): TableMeta {
        const owner = model.metadata.key ? ModelRegistry.getOwner(model) : undefined;
        const cache = new Map<string, TableMeta>();
        return TableMetaFactory.createWithCache(model, owner, cache);
    }

    private static createWithCache(
        model: TableMetaModel,
        owner: ModelRegistry | undefined,
        cache: Map<string, TableMeta>
    ): TableMeta {
        if (model.metadata.key) {
            const cached = cache.get(model.metadata.key);
            if (cached) {
                return cached;
            }
        }

        const pkField = model.metadata.fields.find((field) => field.primaryKey);
        if (!pkField) {
            throw new Error(`Model '${model.metadata.name}' cannot attach a manager without a primary key field.`);
        }

        const tableMeta: TableMeta = {
            modelKey: model.metadata.key,
            table: model.metadata.table,
            pk: pkField.name,
            columns: Object.fromEntries(model.metadata.fields.map((field) => [field.name, field.type])),
        };

        if (model.metadata.key) {
            cache.set(model.metadata.key, tableMeta);
        }

        if (!model.metadata.key || !owner) {
            return tableMeta;
        }

        const relations = owner.getResolvedRelationGraph().byModel.get(model.metadata.key);
        if (!relations || relations.size === 0) {
            return tableMeta;
        }

        tableMeta.relations = Object.fromEntries(
            Array.from(relations.entries())
                .filter(([, relation]) => relation.capabilities.queryable && relation.capabilities.hydratable)
                .map(([name, relation]) => {
                    const targetModel = owner.getByKey(relation.targetModelKey)!;
                    const targetMeta = TableMetaFactory.createWithCache(targetModel, owner, cache);
                    const { queryable, hydratable } = relation.capabilities;
                    const isSingleRelation =
                        relation.kind === InternalRelationKind.BELONGS_TO ||
                        relation.kind === InternalRelationKind.HAS_ONE;
                    const sourceKey =
                        relation.kind === InternalRelationKind.BELONGS_TO
                            ? relation.localFieldName
                            : relation.targetFieldName;
                    const targetKey =
                        relation.kind === InternalRelationKind.BELONGS_TO
                            ? relation.targetFieldName
                            : relation.localFieldName;
                    const targetColumns = Object.fromEntries(
                        targetModel.metadata.fields.map((field) => [field.name, field.type])
                    );
                    const capabilities: RelationMeta['capabilities'] = {
                        queryable,
                        hydratable,
                        joinable: isSingleRelation && queryable && hydratable,
                        prefetchable: queryable && hydratable,
                    };

                    return [
                        name,
                        {
                            edgeId: relation.edgeId,
                            sourceModelKey: relation.sourceModelKey,
                            targetModelKey: relation.targetModelKey,
                            kind: relation.kind as RelationMeta['kind'],
                            cardinality: isSingleRelation ? 'single' : 'many',
                            capabilities,
                            table: targetModel.metadata.table,
                            sourceKey: sourceKey as string,
                            targetKey: targetKey as string,
                            targetPrimaryKey: targetMeta.pk,
                            targetColumns,
                            alias: relation.alias,
                            targetMeta,
                        } satisfies RelationMeta,
                    ];
                })
        );

        return tableMeta;
    }
}
