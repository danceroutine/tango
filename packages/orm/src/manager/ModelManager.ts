import { NotFoundError } from '@danceroutine/tango-core';
import { ModelRegistry, type ModelWriteHooks } from '@danceroutine/tango-schema';
import type { FilterInput, RelationMeta, TableMeta } from '../query/domain/index';
import { InternalRelationKind } from '../query/domain/internal/InternalRelationKind';
import type { QuerySet } from '../query/index';
import { QuerySet as QuerySetClass } from '../query/index';
import type { Dialect, QueryExecutor } from '../query/index';
import type { TangoRuntime } from '../runtime/TangoRuntime';
import { OrmSqlSafetyAdapter } from '../validation';
import type { ManagerLike } from './ManagerLike';
import { MutationCompiler } from './internal/MutationCompiler';
import { RuntimeBoundClient } from './internal/RuntimeBoundClient';

const sqlSafetyAdapter = new OrmSqlSafetyAdapter();

type FieldLike = {
    name: string;
    type: string;
    primaryKey?: boolean;
};

type ModelLike<TModelRow extends Record<string, unknown>> = {
    metadata: {
        key?: string;
        name: string;
        table: string;
        fields: FieldLike[];
    };
    schema: {
        parse(input: unknown): TModelRow;
    };
    hooks?: ModelWriteHooks<TModelRow>;
};

/**
 * Model-backed data access API exposed as `Model.objects`.
 */
export class ModelManager<TModelRow extends Record<string, unknown>, TSourceModel = unknown>
    implements ManagerLike<TModelRow, TSourceModel>
{
    static readonly BRAND = 'tango.orm.model_manager' as const;
    readonly __tangoBrand: typeof ModelManager.BRAND = ModelManager.BRAND;
    private readonly queryExecutor: QueryExecutor<TModelRow>;
    private readonly mutationCompiler: MutationCompiler;
    private readonly model: ModelLike<TModelRow>;
    private readonly client: RuntimeBoundClient;
    private readonly dialect: Dialect;

    constructor(model: ModelLike<TModelRow>, runtime: TangoRuntime) {
        this.model = model;
        this.client = new RuntimeBoundClient(runtime);
        this.dialect = runtime.getDialect() as Dialect;
        this.mutationCompiler = new MutationCompiler(this.dialect);
        this.queryExecutor = {
            get meta() {
                return ModelManager.createTableMeta(model);
            },
            client: this.client,
            dialect: this.dialect,
            run: async (compiled) => {
                const result = await this.client.query<TModelRow>(compiled.sql, compiled.params);
                return result.rows;
            },
        };
    }

    get meta(): TableMeta {
        return ModelManager.createTableMeta(this.model);
    }

    /**
     * Narrow an unknown value to `ModelManager`.
     */
    static isModelManager<TModelRow extends Record<string, unknown>>(value: unknown): value is ModelManager<TModelRow> {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === ModelManager.BRAND
        );
    }

    private static createTableMeta<TModelRow extends Record<string, unknown>>(model: ModelLike<TModelRow>): TableMeta {
        const pkField = model.metadata.fields.find((field) => field.primaryKey);
        if (!pkField) {
            throw new Error(`Model '${model.metadata.name}' cannot attach a manager without a primary key field.`);
        }

        const rawMeta: TableMeta = {
            table: model.metadata.table,
            pk: pkField.name,
            columns: Object.fromEntries(model.metadata.fields.map((field) => [field.name, field.type])),
        };

        if (model.metadata.key) {
            const owner = ModelRegistry.getOwner(model as never);
            const relations = owner.getResolvedRelationGraph().byModel.get(model.metadata.key);
            if (relations && relations.size > 0) {
                // This metadata is recomputed on access today. Most application tables have a small relation set, so
                // keeping this path direct is acceptable until profiling points to a dedicated manager-meta cache.
                rawMeta.relations = Object.fromEntries(
                    Array.from(relations.entries())
                        .filter(([, relation]) => relation.kind !== InternalRelationKind.MANY_TO_MANY)
                        .map(([name, relation]) => {
                            const targetModel = owner.getByKey(relation.targetModelKey)!;
                            // Query planning needs the target model's SQL-facing shape so joined and prefetched rows can be
                            // selected, normalized, and attached without leaking internal alias columns.
                            const targetColumns = Object.fromEntries(
                                targetModel.metadata.fields.map((field) => [field.name, field.type])
                            );
                            // Forward relations join from this table's FK to the target key. Reverse relations flip that:
                            // this table's primary key matches the target model's FK back to this model.
                            const sourceKey =
                                relation.kind === InternalRelationKind.BELONGS_TO
                                    ? relation.localFieldName
                                    : relation.targetFieldName;
                            const targetKey =
                                relation.kind === InternalRelationKind.BELONGS_TO
                                    ? relation.targetFieldName
                                    : relation.localFieldName;

                            return [
                                name,
                                {
                                    kind: relation.kind as RelationMeta['kind'],
                                    table: targetModel.metadata.table,
                                    sourceKey: sourceKey as string,
                                    targetKey: targetKey as string,
                                    targetColumns,
                                    alias: relation.alias,
                                },
                            ];
                        })
                );
            }
        }

        const validatedMeta = sqlSafetyAdapter.validate({
            kind: 'insert',
            meta: rawMeta,
            writeKeys: Object.keys(rawMeta.columns),
        }).meta;

        if (rawMeta.relations) {
            validatedMeta.relations = rawMeta.relations;
        }

        return validatedMeta;
    }

    query(): QuerySet<TModelRow, TModelRow, TSourceModel> {
        return new QuerySetClass<TModelRow, TModelRow, TSourceModel>(this.queryExecutor, {});
    }

    async findById(id: TModelRow[keyof TModelRow]): Promise<TModelRow | null> {
        const filter = { [this.meta.pk]: id } as unknown as FilterInput<TModelRow>;
        return this.query().filter(filter).fetchOne();
    }

    async getOrThrow(id: TModelRow[keyof TModelRow]): Promise<TModelRow> {
        const result = await this.findById(id);
        if (!result) {
            throw new NotFoundError(`${this.model.metadata.name} with ${this.meta.pk}=${String(id)} not found`);
        }
        return result;
    }

    async create(input: Partial<TModelRow>): Promise<TModelRow> {
        const prepared = await this.runBeforeCreate(input);
        const preparedKeys = Object.keys(prepared);
        if (preparedKeys.length === 0) {
            throw new Error(`Cannot create ${this.model.metadata.name} without any values.`);
        }

        const validatedPlan = sqlSafetyAdapter.validate({
            kind: 'insert',
            meta: this.meta,
            writeKeys: preparedKeys,
        });
        const compiled = this.mutationCompiler.compileInsert(
            validatedPlan,
            preparedKeys.map((key) => prepared[key as keyof TModelRow])
        );
        const result = await this.queryExecutor.client.query<TModelRow>(compiled.sql, compiled.params);
        const created = result.rows[0]!;
        await this.model.hooks?.afterCreate?.({
            record: created,
            model: this.model,
            manager: this,
        });
        return created;
    }

    async update(id: TModelRow[keyof TModelRow], patch: Partial<TModelRow>): Promise<TModelRow> {
        const current = await this.getOrThrow(id);
        const prepared = await this.runBeforeUpdate(id, patch, current);
        const preparedKeys = Object.keys(prepared);
        if (preparedKeys.length === 0) {
            throw new Error(`Cannot update ${this.model.metadata.name} without any values.`);
        }

        const validatedPlan = sqlSafetyAdapter.validate({
            kind: 'update',
            meta: this.meta,
            writeKeys: preparedKeys,
        });
        const compiled = this.mutationCompiler.compileUpdate(
            validatedPlan,
            preparedKeys.map((key) => prepared[key as keyof TModelRow]),
            id
        );
        const result = await this.queryExecutor.client.query<TModelRow>(compiled.sql, compiled.params);
        const updated = result.rows[0]!;
        await this.model.hooks?.afterUpdate?.({
            id,
            patch: prepared,
            previous: current,
            record: updated,
            model: this.model,
            manager: this,
        });
        return updated;
    }

    async delete(id: TModelRow[keyof TModelRow]): Promise<void> {
        const current = await this.getOrThrow(id);
        await this.model.hooks?.beforeDelete?.({
            id,
            current,
            model: this.model,
            manager: this,
        });
        const validatedPlan = sqlSafetyAdapter.validate({
            kind: 'delete',
            meta: this.meta,
        });
        const compiled = this.mutationCompiler.compileDelete(validatedPlan, id);
        await this.queryExecutor.client.query(compiled.sql, compiled.params);
        await this.model.hooks?.afterDelete?.({
            id,
            previous: current,
            model: this.model,
            manager: this,
        });
    }

    async bulkCreate(inputs: Partial<TModelRow>[]): Promise<TModelRow[]> {
        if (inputs.length === 0) {
            return [];
        }

        const perRowPrepared = await Promise.all(inputs.map((input) => this.runBeforeCreate(input)));
        const batchPrepared: Partial<TModelRow>[] =
            (await this.model.hooks?.beforeBulkCreate?.({
                rows: perRowPrepared,
                model: this.model,
                manager: this,
            })) ?? perRowPrepared;
        const preparedKeys = Object.keys(batchPrepared[0] ?? {});
        if (preparedKeys.length === 0) {
            throw new Error(`Cannot create ${this.model.metadata.name} without any values.`);
        }

        const validatedPlan = sqlSafetyAdapter.validate({
            kind: 'insert',
            meta: this.meta,
            writeKeys: preparedKeys,
        });
        const valueRows = batchPrepared.map((input) => preparedKeys.map((key) => input[key as keyof TModelRow]));
        const compiled = this.mutationCompiler.compileBulkInsert(validatedPlan, valueRows);
        const result = await this.queryExecutor.client.query<TModelRow>(compiled.sql, compiled.params);
        await Promise.all(
            result.rows.map((record) =>
                this.model.hooks?.afterCreate?.({
                    record,
                    model: this.model,
                    manager: this,
                })
            )
        );
        await this.model.hooks?.afterBulkCreate?.({
            records: result.rows,
            model: this.model,
            manager: this,
        });
        return result.rows;
    }

    private async runBeforeCreate(data: Partial<TModelRow>): Promise<Partial<TModelRow>> {
        return (
            (await this.model.hooks?.beforeCreate?.({
                data,
                model: this.model,
                manager: this,
            })) ?? data
        );
    }

    private async runBeforeUpdate(
        id: TModelRow[keyof TModelRow],
        patch: Partial<TModelRow>,
        current: TModelRow
    ): Promise<Partial<TModelRow>> {
        return (
            (await this.model.hooks?.beforeUpdate?.({
                id,
                patch,
                current,
                model: this.model,
                manager: this,
            })) ?? patch
        );
    }
}
