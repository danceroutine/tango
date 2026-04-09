/**
 * Domain boundary barrel: centralizes this subdomain's public contract.
 */

export type { FieldType } from './FieldType';
export type { DeleteReferentialAction } from './DeleteReferentialAction';
export type { UpdateReferentialAction } from './UpdateReferentialAction';
export type { RelationType } from './RelationType';
export type { Field } from './Field';
export type { IndexDef } from './IndexDef';
export type { RelationDef } from './RelationDef';
export type { ModelMetadata } from './ModelMetadata';
export type { Model, ModelAugmentations, ModelKeyOf, PersistedModelOutput } from './Model';
export type {
    ModelHookModel,
    ModelWriteHookOnCommitOptions,
    ModelWriteHookManager,
    ModelWriteHookTransaction,
    ModelWriteHooks,
    BeforeCreateHookArgs,
    AfterCreateHookArgs,
    BeforeUpdateHookArgs,
    AfterUpdateHookArgs,
    BeforeDeleteHookArgs,
    AfterDeleteHookArgs,
    BeforeBulkCreateHookArgs,
    AfterBulkCreateHookArgs,
} from './ModelWriteHooks';
