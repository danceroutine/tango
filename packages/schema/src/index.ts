/**
 * Bundled exports for Django-style domain drill-down imports, plus curated
 * top-level symbols for TS-native ergonomic imports.
 */
export * as domain from './domain/index';
export * as model from './model/index';

export type {
    DeleteReferentialAction,
    Field,
    FieldType,
    IndexDef,
    ModelHookModel,
    ModelAugmentations,
    ModelMetadata,
    PersistedModelOutput,
    ModelWriteHookManager,
    ModelWriteHooks,
    BeforeCreateHookArgs,
    AfterCreateHookArgs,
    BeforeUpdateHookArgs,
    AfterUpdateHookArgs,
    BeforeDeleteHookArgs,
    AfterDeleteHookArgs,
    BeforeBulkCreateHookArgs,
    AfterBulkCreateHookArgs,
    RelationDef,
    RelationType,
    UpdateReferentialAction,
} from './domain/index';
export {
    Model,
    RelationBuilder,
    ModelRegistry,
    registerModelAugmentor,
    Constraints,
    Decorators,
    Indexes,
    Meta,
    c,
    i,
    m,
    t,
    type ModelDefinition,
    type ForeignKeyDecoratorConfig,
    type FieldDecoratorBuilder,
    type ManyToManyDecoratorConfig,
    type OneToOneDecoratorConfig,
} from './model/index';
