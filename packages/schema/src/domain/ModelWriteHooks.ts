export interface ModelWriteHookManager<TModel extends Record<string, unknown>> {
    create(input: Partial<TModel>): Promise<TModel>;
    update(id: TModel[keyof TModel], patch: Partial<TModel>): Promise<TModel>;
    delete(id: TModel[keyof TModel]): Promise<void>;
    bulkCreate(inputs: Partial<TModel>[]): Promise<TModel[]>;
}

export interface ModelWriteHookOnCommitOptions {
    robust?: boolean;
}

export interface ModelWriteHookTransaction {
    onCommit(callback: () => void, options?: ModelWriteHookOnCommitOptions): void;
}

/**
 * Structural model contract passed into write lifecycle hooks.
 */
export interface ModelHookModel<TModel extends Record<string, unknown>> {
    metadata: {
        table: string;
    };
    schema: {
        parse(input: unknown): TModel;
    };
    hooks?: ModelWriteHooks<TModel>;
}

export interface BeforeCreateHookArgs<TModel extends Record<string, unknown>> {
    data: Partial<TModel>;
    model: ModelHookModel<TModel>;
    manager: ModelWriteHookManager<TModel>;
    transaction?: ModelWriteHookTransaction;
}

export interface AfterCreateHookArgs<TModel extends Record<string, unknown>> {
    record: TModel;
    model: ModelHookModel<TModel>;
    manager: ModelWriteHookManager<TModel>;
    transaction?: ModelWriteHookTransaction;
}

export interface BeforeUpdateHookArgs<TModel extends Record<string, unknown>> {
    id: TModel[keyof TModel];
    patch: Partial<TModel>;
    current: TModel;
    model: ModelHookModel<TModel>;
    manager: ModelWriteHookManager<TModel>;
    transaction?: ModelWriteHookTransaction;
}

export interface AfterUpdateHookArgs<TModel extends Record<string, unknown>> {
    id: TModel[keyof TModel];
    patch: Partial<TModel>;
    previous: TModel;
    record: TModel;
    model: ModelHookModel<TModel>;
    manager: ModelWriteHookManager<TModel>;
    transaction?: ModelWriteHookTransaction;
}

export interface BeforeDeleteHookArgs<TModel extends Record<string, unknown>> {
    id: TModel[keyof TModel];
    current: TModel;
    model: ModelHookModel<TModel>;
    manager: ModelWriteHookManager<TModel>;
    transaction?: ModelWriteHookTransaction;
}

export interface AfterDeleteHookArgs<TModel extends Record<string, unknown>> {
    id: TModel[keyof TModel];
    previous: TModel;
    model: ModelHookModel<TModel>;
    manager: ModelWriteHookManager<TModel>;
    transaction?: ModelWriteHookTransaction;
}

export interface BeforeBulkCreateHookArgs<TModel extends Record<string, unknown>> {
    rows: Partial<TModel>[];
    model: ModelHookModel<TModel>;
    manager: ModelWriteHookManager<TModel>;
    transaction?: ModelWriteHookTransaction;
}

export interface AfterBulkCreateHookArgs<TModel extends Record<string, unknown>> {
    records: TModel[];
    model: ModelHookModel<TModel>;
    manager: ModelWriteHookManager<TModel>;
    transaction?: ModelWriteHookTransaction;
}

/**
 * Async-capable model-owned write lifecycle hooks.
 *
 * Use model hooks for persistence rules that should apply everywhere the model
 * is written, including serializers, viewsets, scripts, and direct manager
 * calls.
 */
export interface ModelWriteHooks<TModel extends Record<string, unknown>> {
    beforeCreate?(args: BeforeCreateHookArgs<TModel>): Promise<Partial<TModel> | void> | Partial<TModel> | void;
    afterCreate?(args: AfterCreateHookArgs<TModel>): Promise<void> | void;
    beforeUpdate?(args: BeforeUpdateHookArgs<TModel>): Promise<Partial<TModel> | void> | Partial<TModel> | void;
    afterUpdate?(args: AfterUpdateHookArgs<TModel>): Promise<void> | void;
    beforeDelete?(args: BeforeDeleteHookArgs<TModel>): Promise<void> | void;
    afterDelete?(args: AfterDeleteHookArgs<TModel>): Promise<void> | void;
    beforeBulkCreate?(
        args: BeforeBulkCreateHookArgs<TModel>
    ): Promise<Partial<TModel>[] | void> | Partial<TModel>[] | void;
    afterBulkCreate?(args: AfterBulkCreateHookArgs<TModel>): Promise<void> | void;
}
