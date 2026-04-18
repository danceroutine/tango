import { NotFoundError } from '@danceroutine/tango-core';
import type { QNode } from '../query/domain/QNode';
import { InternalQNodeType } from '../query/domain/internal/InternalQNodeType';
import type { ModelWriteHooks } from '@danceroutine/tango-schema';
import type { Model as SchemaModel } from '@danceroutine/tango-schema/domain';
import type { FilterInput, TableMeta } from '../query/domain/index';
import { TableMetaFactory } from '../query/domain/TableMetaFactory';
import type { QuerySet } from '../query/index';
import { QuerySet as QuerySetClass } from '../query/index';
import type { Dialect, QueryExecutor } from '../query/index';
import type { TangoRuntime } from '../runtime/TangoRuntime';
import { OrmSqlSafetyAdapter } from '../validation';
import { TransactionEngine } from '../transaction/internal/context';
import type { ManagerLike } from './ManagerLike';
import { MutationCompiler } from './internal/MutationCompiler';
import { RuntimeBoundClient } from './internal/RuntimeBoundClient';

const sqlSafetyAdapter = new OrmSqlSafetyAdapter();

type ModelMetadataLike = Omit<SchemaModel['metadata'], 'key' | 'namespace' | 'fields'> & {
    key?: string;
    namespace?: string;
    fields: Array<{
        name: string;
        type: string;
        primaryKey?: boolean;
    }>;
};

type ModelLike<TModelRow extends Record<string, unknown>> = {
    metadata: ModelMetadataLike;
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
    private readonly runtime: TangoRuntime;

    constructor(model: ModelLike<TModelRow>, runtime: TangoRuntime) {
        this.model = model;
        this.runtime = runtime;
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
        const rawMeta = TableMetaFactory.create(model);
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

    all(): QuerySet<TModelRow, TModelRow, TSourceModel> {
        return this.query();
    }

    async getOrCreate(args: {
        where: FilterInput<TModelRow> | QNode<TModelRow>;
        defaults?: Partial<TModelRow>;
    }): Promise<{ record: TModelRow; created: boolean }> {
        const existing = await this.query().filter(args.where).fetchOne();
        if (existing) {
            return { record: existing, created: false };
        }
        const merged = ModelManager.mergeCreatePayloadFromWhere(
            this.model.metadata.name,
            this.meta.pk,
            args.where,
            args.defaults
        );
        const record = await this.create(merged);
        return { record, created: true };
    }

    async updateOrCreate(args: {
        where: FilterInput<TModelRow> | QNode<TModelRow>;
        defaults?: Partial<TModelRow>;
        update?: Partial<TModelRow>;
    }): Promise<{ record: TModelRow; created: boolean; updated: boolean }> {
        const existing = await this.query().filter(args.where).fetchOne();
        if (!existing) {
            const merged = ModelManager.mergeCreatePayloadFromWhere(
                this.model.metadata.name,
                this.meta.pk,
                args.where,
                args.defaults
            );
            const record = await this.create(merged);
            return { record, created: true, updated: false };
        }

        const patch = args.update ?? args.defaults ?? {};
        const patchKeys = Object.keys(patch);
        if (patchKeys.length === 0) {
            return { record: existing, created: false, updated: false };
        }

        const id = existing[this.meta.pk as keyof TModelRow] as TModelRow[keyof TModelRow];
        const record = await this.update(id, patch);
        return { record, created: false, updated: true };
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
            transaction: this.getHookTransaction(),
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
            transaction: this.getHookTransaction(),
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
            transaction: this.getHookTransaction(),
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
            transaction: this.getHookTransaction(),
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
                transaction: this.getHookTransaction(),
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
                    transaction: this.getHookTransaction(),
                })
            )
        );
        await this.model.hooks?.afterBulkCreate?.({
            records: result.rows,
            model: this.model,
            manager: this,
            transaction: this.getHookTransaction(),
        });
        return result.rows;
    }

    private async runBeforeCreate(data: Partial<TModelRow>): Promise<Partial<TModelRow>> {
        return (
            (await this.model.hooks?.beforeCreate?.({
                data,
                model: this.model,
                manager: this,
                transaction: this.getHookTransaction(),
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
                transaction: this.getHookTransaction(),
            })) ?? patch
        );
    }

    private getHookTransaction() {
        return TransactionEngine.forRuntime(this.runtime).getActiveTransaction();
    }

    private static mergeCreatePayloadFromWhere<TModelRow extends Record<string, unknown>>(
        modelName: string,
        pkColumn: string,
        where: FilterInput<TModelRow> | QNode<TModelRow>,
        defaults?: Partial<TModelRow>
    ): Partial<TModelRow> {
        const hasDefaultsArg = defaults !== undefined;
        const providedDefaults =
            defaults !== undefined ? ({ ...defaults } as Partial<TModelRow>) : undefined;

        if (ModelManager.isQNodeLike(where)) {
            if (!hasDefaultsArg) {
                throw new Error(`Cannot create ${modelName} from Q filters without defaults.`);
            }
            if (!providedDefaults || Object.keys(providedDefaults).length === 0) {
                throw new Error(`Cannot create ${modelName} from Q filters without defaults.`);
            }
            const fromQ = ModelManager.collectPlainFieldsFromQNode(modelName, where);
            const merged = { ...fromQ, ...providedDefaults };
            const keys = Object.keys(merged).filter((key) => merged[key as keyof TModelRow] !== undefined);
            const nonPkKeys = keys.filter((key) => key !== pkColumn);
            if (nonPkKeys.length === 0) {
                throw new Error(`Cannot create ${modelName} without any values.`);
            }
            return merged;
        }

        const atom = where as FilterInput<TModelRow>;
        const entries = Object.entries(atom as Record<string, unknown>);
        const plainEntries = entries.filter(([key]) => !String(key).includes('__'));
        const lookupOnly = entries.length > 0 && plainEntries.length === 0;

        const fromAtom =
            plainEntries.length > 0 ? (Object.fromEntries(plainEntries) as Partial<TModelRow>) : undefined;
        const mergeBase = { ...fromAtom, ...providedDefaults };

        if (lookupOnly && ModelManager.countNonPkValues(mergeBase) === 0) {
            throw new Error(`Cannot create ${modelName} from lookup-only filters without defaults.`);
        }

        const cleanedAtom =
            plainEntries.length > 0 ? (Object.fromEntries(plainEntries) as Partial<TModelRow>) : ({} as Partial<TModelRow>);
        const merged = { ...cleanedAtom, ...mergeBase };
        const keys = Object.keys(merged).filter((key) => merged[key as keyof TModelRow] !== undefined);
        const nonPkKeys = keys.filter((key) => key !== pkColumn);
        if (nonPkKeys.length === 0) {
            throw new Error(`Cannot create ${modelName} without any values.`);
        }
        return merged;
    }

    private static countNonPkValues<TModelRow extends Record<string, unknown>>(payload: Partial<TModelRow>): number {
        return Object.entries(payload as Record<string, unknown>).filter(([, value]) => value !== undefined).length;
    }

    private static isQNodeLike<TModelRow extends Record<string, unknown>>(
        value: FilterInput<TModelRow> | QNode<TModelRow>
    ): value is QNode<TModelRow> {
        return (
            typeof value === 'object' &&
            value !== null &&
            'kind' in value &&
            typeof (value as { kind: unknown }).kind === 'string' &&
            !('__tangoBrand' in value)
        );
    }

    private static collectPlainFieldsFromQNode<TModelRow extends Record<string, unknown>>(
        modelName: string,
        node: QNode<TModelRow>
    ): Partial<TModelRow> {
        switch (node.kind) {
            case InternalQNodeType.ATOM: {
                const atom = node.where as FilterInput<TModelRow>;
                return ModelManager.omitLookupKeysFromAtom(atom);
            }
            case InternalQNodeType.AND: {
                const partials = (node.nodes ?? []).map((child) =>
                    ModelManager.collectPlainFieldsFromQNode(modelName, child)
                );
                return ModelManager.mergeCompatiblePartials(partials);
            }
            case InternalQNodeType.OR: {
                const partials = (node.nodes ?? []).map((child) =>
                    ModelManager.collectPlainFieldsFromQNode(modelName, child)
                );
                const nonEmpty = partials.filter((p) => Object.keys(p as Record<string, unknown>).length > 0);
                if (nonEmpty.length > 1) {
                    throw new Error(
                        `Cannot derive a create payload from ${modelName} OR filters with multiple predicates. Supply defaults that fully describe the insert.`
                    );
                }
                return nonEmpty.length === 1 ? nonEmpty[0]! : {};
            }
            case InternalQNodeType.NOT:
                return {};
        }
    }

    private static omitLookupKeysFromAtom<TModelRow extends Record<string, unknown>>(
        atom: FilterInput<TModelRow>
    ): Partial<TModelRow> {
        const entries = Object.entries(atom as Record<string, unknown>).filter(([key]) => !String(key).includes('__'));
        return Object.fromEntries(entries) as Partial<TModelRow>;
    }

    private static mergeCompatiblePartials<TModelRow extends Record<string, unknown>>(
        partials: Array<Partial<TModelRow>>
    ): Partial<TModelRow> {
        const merged: Partial<TModelRow> = {};
        for (const partial of partials) {
            for (const [key, value] of Object.entries(partial as Record<string, unknown>)) {
                const existing = merged[key as keyof TModelRow];
                if (existing !== undefined && existing !== value) {
                    throw new Error(`Conflicting values for '${key}' while deriving create payload from Q filters.`);
                }
                (merged as Record<string, unknown>)[key] = value;
            }
        }
        return merged;
    }

}
