import { NotFoundError } from '@danceroutine/tango-core';
import type { ModelWriteHooks } from '@danceroutine/tango-schema';
import type { FilterInput, TableMeta } from '../query/domain/index';
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

type ModelLike<T extends Record<string, unknown>> = {
    metadata: {
        name: string;
        table: string;
        fields: FieldLike[];
    };
    schema: {
        parse(input: unknown): T;
    };
    hooks?: ModelWriteHooks<T>;
};

/**
 * Model-backed data access API exposed as `Model.objects`.
 */
export class ModelManager<T extends Record<string, unknown>> implements ManagerLike<T> {
    static readonly BRAND = 'tango.orm.model_manager' as const;
    readonly __tangoBrand: typeof ModelManager.BRAND = ModelManager.BRAND;
    readonly meta: TableMeta;
    private readonly queryExecutor: QueryExecutor<T>;
    private readonly mutationCompiler: MutationCompiler;
    private readonly model: ModelLike<T>;

    constructor(model: ModelLike<T>, runtime: TangoRuntime) {
        this.model = model;
        this.meta = ModelManager.createTableMeta(model);
        const client = new RuntimeBoundClient(runtime);
        const dialect = runtime.getDialect() as Dialect;
        this.mutationCompiler = new MutationCompiler(dialect);
        this.queryExecutor = {
            meta: this.meta,
            client,
            dialect,
            run: async (compiled) => {
                const result = await client.query<T>(compiled.sql, compiled.params);
                return result.rows;
            },
        };
    }

    /**
     * Narrow an unknown value to `ModelManager`.
     */
    static isModelManager<T extends Record<string, unknown>>(value: unknown): value is ModelManager<T> {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === ModelManager.BRAND
        );
    }

    private static createTableMeta<T extends Record<string, unknown>>(model: ModelLike<T>): TableMeta {
        const pkField = model.metadata.fields.find((field) => field.primaryKey);
        if (!pkField) {
            throw new Error(`Model '${model.metadata.name}' cannot attach a manager without a primary key field.`);
        }

        const rawMeta: TableMeta = {
            table: model.metadata.table,
            pk: pkField.name,
            columns: Object.fromEntries(model.metadata.fields.map((field) => [field.name, field.type])),
        };

        return sqlSafetyAdapter.validate({
            kind: 'insert',
            meta: rawMeta,
            writeKeys: Object.keys(rawMeta.columns),
        }).meta;
    }

    query(): QuerySet<T> {
        return new QuerySetClass<T>(this.queryExecutor, {});
    }

    async findById(id: T[keyof T]): Promise<T | null> {
        const filter = { [this.meta.pk]: id } as unknown as FilterInput<T>;
        return this.query().filter(filter).fetchOne();
    }

    async getOrThrow(id: T[keyof T]): Promise<T> {
        const result = await this.findById(id);
        if (!result) {
            throw new NotFoundError(`${this.model.metadata.name} with ${this.meta.pk}=${String(id)} not found`);
        }
        return result;
    }

    async create(input: Partial<T>): Promise<T> {
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
            preparedKeys.map((key) => prepared[key as keyof T])
        );
        const result = await this.queryExecutor.client.query<T>(compiled.sql, compiled.params);
        const created = result.rows[0]!;
        await this.model.hooks?.afterCreate?.({
            record: created,
            model: this.model,
            manager: this,
        });
        return created;
    }

    async update(id: T[keyof T], patch: Partial<T>): Promise<T> {
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
            preparedKeys.map((key) => prepared[key as keyof T]),
            id
        );
        const result = await this.queryExecutor.client.query<T>(compiled.sql, compiled.params);
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

    async delete(id: T[keyof T]): Promise<void> {
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

    async bulkCreate(inputs: Partial<T>[]): Promise<T[]> {
        if (inputs.length === 0) {
            return [];
        }

        const perRowPrepared = await Promise.all(inputs.map((input) => this.runBeforeCreate(input)));
        const batchPrepared: Partial<T>[] =
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
        const valueRows = batchPrepared.map((input) => preparedKeys.map((key) => input[key as keyof T]));
        const compiled = this.mutationCompiler.compileBulkInsert(validatedPlan, valueRows);
        const result = await this.queryExecutor.client.query<T>(compiled.sql, compiled.params);
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

    private async runBeforeCreate(data: Partial<T>): Promise<Partial<T>> {
        return (
            (await this.model.hooks?.beforeCreate?.({
                data,
                model: this.model,
                manager: this,
            })) ?? data
        );
    }

    private async runBeforeUpdate(id: T[keyof T], patch: Partial<T>, current: T): Promise<Partial<T>> {
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
