import { NotFoundError } from '@danceroutine/tango-core';
import { ModelRegistry } from '@danceroutine/tango-schema';
import type { ModelWriteHooks } from '@danceroutine/tango-schema';
import type { Model as SchemaModel } from '@danceroutine/tango-schema/domain';
import type { QNode } from '../query/domain/QNode';
import type { FilterInput, TableMeta } from '../query/domain/index';
import { InternalRelationKind } from '../query/domain/internal/InternalRelationKind';
import { InternalQNodeType } from '../query/domain/internal/InternalQNodeType';
import { TableMetaFactory } from '../query/domain/TableMetaFactory';
import { ModelQuerySet } from '../query/index';
import type { QuerySet } from '../query/index';
import type { QueryExecutor } from '../query/index';
import type { Adapter } from '../connection/adapters/Adapter';
import type { TangoRuntime } from '../runtime/TangoRuntime';
import { OrmSqlSafetyAdapter } from '../validation';
import { InternalSqlValidationPlanKind as SqlPlanKind } from '../validation/internal/InternalSqlValidationPlanKind';
import { TransactionEngine } from '../transaction/internal/context';
import type { ManagerLike } from './ManagerLike';
import { MutationCompiler } from './internal/MutationCompiler';
import { RuntimeBoundClient } from './internal/RuntimeBoundClient';
import { ManyToManyRelatedManager } from './relations/ManyToManyRelatedManager';
import { isQNodeLike } from '../query/internal/isQNodeLike';

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
    private readonly adapter: Adapter;
    private readonly runtime: TangoRuntime;

    constructor(model: ModelLike<TModelRow>, runtime: TangoRuntime) {
        this.model = model;
        this.runtime = runtime;
        this.client = new RuntimeBoundClient(runtime);
        this.adapter = runtime.getAdapter();
        this.mutationCompiler = new MutationCompiler(this.adapter);
        this.queryExecutor = {
            get meta() {
                return ModelManager.createTableMeta(model);
            },
            client: this.client,
            adapter: this.adapter,
            run: async (compiled) => {
                const result = await this.client.query<TModelRow>(compiled.sql, compiled.params);
                return result.rows;
            },
            attachPersistedRecordAccessors: (record, modelKey) => {
                this.attachManyToManyRelatedManagers(record, modelKey ?? this.model.metadata.key);
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
        const rawMeta = TableMetaFactory.create(model as SchemaModel);
        const validatedMeta = sqlSafetyAdapter.validate({
            kind: SqlPlanKind.INSERT,
            meta: rawMeta,
            writeKeys: Object.keys(rawMeta.columns),
        }).meta;

        if (rawMeta.relations) {
            validatedMeta.relations = rawMeta.relations;
        }

        return validatedMeta;
    }

    private static mergeCreatePayloadFromWhere<TModelRow extends Record<string, unknown>>(
        modelName: string,
        pkColumn: string,
        where: FilterInput<TModelRow> | QNode<TModelRow>,
        defaults?: Partial<TModelRow>
    ): Partial<TModelRow> {
        const hasDefaultsArg = defaults !== undefined;
        const providedDefaults = defaults !== undefined ? ({ ...defaults } as Partial<TModelRow>) : undefined;

        if (isQNodeLike(where)) {
            if (!hasDefaultsArg || !providedDefaults || Object.keys(providedDefaults).length === 0) {
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
        const fromAtom = plainEntries.length > 0 ? (Object.fromEntries(plainEntries) as Partial<TModelRow>) : undefined;
        const mergeBase = { ...fromAtom, ...providedDefaults };

        if (lookupOnly && ModelManager.countDefinedValues(mergeBase, pkColumn) === 0) {
            throw new Error(`Cannot create ${modelName} from lookup-only filters without defaults.`);
        }

        const cleanedAtom =
            plainEntries.length > 0
                ? (Object.fromEntries(plainEntries) as Partial<TModelRow>)
                : ({} as Partial<TModelRow>);
        const merged = { ...cleanedAtom, ...mergeBase };
        const keys = Object.keys(merged).filter((key) => merged[key as keyof TModelRow] !== undefined);
        const nonPkKeys = keys.filter((key) => key !== pkColumn);
        if (nonPkKeys.length === 0) {
            throw new Error(`Cannot create ${modelName} without any values.`);
        }
        return merged;
    }

    private static countDefinedValues<TModelRow extends Record<string, unknown>>(
        payload: Partial<TModelRow>,
        pkColumn: string
    ): number {
        return Object.entries(payload as Record<string, unknown>).filter(
            ([key, value]) => key !== pkColumn && value !== undefined
        ).length;
    }

    private static collectPlainFieldsFromQNode<TModelRow extends Record<string, unknown>>(
        modelName: string,
        node: QNode<TModelRow>
    ): Partial<TModelRow> {
        switch (node.kind) {
            case InternalQNodeType.ATOM:
                return ModelManager.omitLookupKeysFromAtom(node.where as FilterInput<TModelRow>);
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
                const nonEmpty = partials.filter(
                    (partial) => Object.keys(partial as Record<string, unknown>).length > 0
                );
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

    query(): QuerySet<TModelRow, TModelRow, TSourceModel> {
        return new ModelQuerySet<TModelRow, TModelRow, TSourceModel>(this.queryExecutor, {});
    }

    all(): QuerySet<TModelRow, TModelRow, TSourceModel> {
        return this.query();
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

    async getOrCreate(args: {
        where: FilterInput<TModelRow> | QNode<TModelRow>;
        defaults?: Partial<TModelRow>;
    }): Promise<{ record: TModelRow; created: boolean }> {
        try {
            const record = await this.query().get(args.where);
            return { record, created: false };
        } catch (error) {
            if (!NotFoundError.isNotFoundError(error)) {
                throw error;
            }
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
        let existing: TModelRow | null = null;
        try {
            existing = await this.query().get(args.where);
        } catch (error) {
            if (!NotFoundError.isNotFoundError(error)) {
                throw error;
            }
        }

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
        if (Object.keys(patch).length === 0) {
            return { record: existing, created: false, updated: false };
        }

        const id = existing[this.meta.pk as keyof TModelRow] as TModelRow[keyof TModelRow];
        const record = await this.update(id, patch);
        return { record, created: false, updated: true };
    }

    async create(input: Partial<TModelRow>): Promise<TModelRow> {
        const prepared = await this.runBeforeCreate(input);
        const preparedKeys = Object.keys(prepared);
        if (preparedKeys.length === 0) {
            throw new Error(`Cannot create ${this.model.metadata.name} without any values.`);
        }

        const validatedPlan = sqlSafetyAdapter.validate({
            kind: SqlPlanKind.INSERT,
            meta: this.meta,
            writeKeys: preparedKeys,
        });
        const compiled = this.mutationCompiler.compileInsert(
            validatedPlan,
            preparedKeys.map((key) => prepared[key as keyof TModelRow])
        );
        const result = await this.queryExecutor.client.query<TModelRow>(compiled.sql, compiled.params);
        const created = result.rows[0]!;
        this.attachOwnRelatedManagers(created);
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
            kind: SqlPlanKind.UPDATE,
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
        this.attachOwnRelatedManagers(updated);
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
        this.attachOwnRelatedManagers(current);
        await this.model.hooks?.beforeDelete?.({
            id,
            current,
            model: this.model,
            manager: this,
            transaction: this.getHookTransaction(),
        });
        const validatedPlan = sqlSafetyAdapter.validate({
            kind: SqlPlanKind.DELETE,
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

    /**
     * Build a {@link ManyToManyRelatedManager} bound to a single owner record
     * for the supplied many-to-many relation. The returned manager performs
     * its INSERT/DELETE writes through the shared runtime-bound client, so
     * mutations enroll in any active `transaction.atomic(...)` boundary.
     */
    createManyToManyRelatedManager<TTarget extends Record<string, unknown>>(
        relationName: string,
        ownerPrimaryKey: unknown
    ): ManyToManyRelatedManager<TTarget> {
        const relation = this.requireManyToManyEdge(relationName);
        const registry = ModelRegistry.getOwner(this.model as SchemaModel);
        const throughModel = registry.getByKey(relation.throughModelKey!)!;
        return ManyToManyRelatedManager.create<TTarget>({
            ownerPrimaryKey,
            relationName,
            ownerModelLabel: this.model.metadata.name,
            relation,
            throughModelFields: throughModel.metadata.fields,
            client: this.client,
            mutationCompiler: this.mutationCompiler,
            adapter: this.adapter,
            sqlSafetyAdapter,
            targetExecutorProvider: () => this.resolveTargetExecutor<TTarget>(relation.targetModelKey),
            runAtomic: (work) => TransactionEngine.forRuntime(this.runtime).atomic(() => work()),
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
            kind: SqlPlanKind.INSERT,
            meta: this.meta,
            writeKeys: preparedKeys,
        });
        const valueRows = batchPrepared.map((input) => preparedKeys.map((key) => input[key as keyof TModelRow]));
        const compiled = this.mutationCompiler.compileBulkInsert(validatedPlan, valueRows);
        const result = await this.queryExecutor.client.query<TModelRow>(compiled.sql, compiled.params);
        for (const record of result.rows) {
            this.attachOwnRelatedManagers(record);
        }
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

    /**
     * Attach a {@link ManyToManyRelatedManager} as a non-enumerable property
     * for every persisted many-to-many relation declared on the supplied
     * record's model. Existing properties are left untouched so that prior
     * hydration writes (such as prefetched arrays) survive the attach pass
     * during the incremental rollout of related-manager hydration.
     */
    private attachOwnRelatedManagers(record: TModelRow): void {
        this.attachManyToManyRelatedManagers(record as unknown as Record<string, unknown>, this.model.metadata.key);
    }

    private attachManyToManyRelatedManagers(record: Record<string, unknown>, modelKey: string | undefined): void {
        if (!modelKey) {
            return;
        }
        const targetManager = this.resolveManagerForModelKey(modelKey);
        if (!targetManager) {
            return;
        }
        const meta = targetManager.meta;
        const relations = meta.relations;
        if (!relations) {
            return;
        }
        const ownerPrimaryKey = record[meta.pk];
        if (ownerPrimaryKey === undefined || ownerPrimaryKey === null) {
            return;
        }
        for (const [relationName, relation] of Object.entries(relations)) {
            if (relation.kind !== InternalRelationKind.MANY_TO_MANY) {
                continue;
            }
            if (Object.prototype.hasOwnProperty.call(record, relationName)) {
                continue;
            }
            const relatedManager = targetManager.createManyToManyRelatedManager(relationName, ownerPrimaryKey);
            Object.defineProperty(record, relationName, {
                value: relatedManager,
                writable: true,
                configurable: true,
                /**
                 * Non-enumerable so `Object.keys(record)`, `JSON.stringify(record)`,
                 * `{ ...record }`, and similar enumeration paths continue to
                 * see only the persisted columns. Application code reaches the
                 * manager through `record.tags`, never through enumeration.
                 */
                enumerable: false,
            });
        }
    }

    private resolveManagerForModelKey(modelKey: string): ModelManager<Record<string, unknown>> | null {
        if (modelKey === this.model.metadata.key) {
            return this as unknown as ModelManager<Record<string, unknown>>;
        }
        const registry = ModelRegistry.getOwner(this.model as SchemaModel);
        const otherModel = registry.getByKey(modelKey);
        if (!otherModel) {
            return null;
        }
        const candidate = (otherModel as { objects?: unknown }).objects;
        return ModelManager.isModelManager(candidate) ? (candidate as ModelManager<Record<string, unknown>>) : null;
    }

    private resolveTargetExecutor<TTarget extends Record<string, unknown>>(
        targetModelKey: string
    ): QueryExecutor<TTarget> | null {
        const targetManager = this.resolveManagerForModelKey(targetModelKey);
        if (!targetManager) {
            return null;
        }
        return (targetManager as unknown as { queryExecutor: QueryExecutor<TTarget> }).queryExecutor;
    }

    private requireManyToManyEdge(relationName: string): NonNullable<TableMeta['relations']>[string] {
        const rel = this.meta.relations?.[relationName];
        if (
            !rel ||
            rel.kind !== InternalRelationKind.MANY_TO_MANY ||
            !rel.throughTable ||
            !rel.throughSourceKey ||
            !rel.throughTargetKey ||
            !rel.throughModelKey
        ) {
            throw new Error(
                `Relation '${relationName}' on '${this.model.metadata.name}' is not a persisted many-to-many edge.`
            );
        }
        return rel;
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
}
