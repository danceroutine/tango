import type { RelationMeta, LookupType } from '../query';
import type {
    DeleteSqlValidationPlan,
    InsertSqlValidationPlan,
    SelectSqlValidationPlan,
    SqlValidationPlan,
    UpdateSqlValidationPlan,
} from './SqlValidationPlan';
import { InternalSqlValidationPlanKind as SqlPlanKind } from './internal/InternalSqlValidationPlanKind';
import { InternalValidatedFilterDescriptorKind } from './internal/InternalValidatedFilterDescriptorKind';

export type ValidatedRelationMeta = RelationMeta & {
    table: string;
    alias: string;
    sourceKey: string;
    targetKey: string;
    targetPrimaryKey: string;
    targetColumns: Record<string, string>;
    throughTable?: string;
    throughSourceKey?: string;
    throughTargetKey?: string;
};

export type ValidatedTableMeta = {
    table: string;
    pk: string;
    columns: Record<string, string>;
    relations?: Record<string, ValidatedRelationMeta>;
};

export type ValidatedColumnFilterDescriptor = {
    kind: typeof InternalValidatedFilterDescriptorKind.COLUMN;
    rawKey: string;
    field: string;
    lookup: LookupType;
    qualifiedColumn: string;
};

export type ValidatedRelationFilterDescriptor = {
    kind: typeof InternalValidatedFilterDescriptorKind.RELATION;
    rawKey: string;
    field: string;
    lookup: LookupType;
    relationPath: string;
    relationChain: ValidatedRelationMeta[];
    terminalColumn: string;
};

export type ValidatedFilterDescriptor = ValidatedColumnFilterDescriptor | ValidatedRelationFilterDescriptor;

export type ValidatedSelectSqlPlan = {
    kind: typeof SqlPlanKind.SELECT;
    meta: ValidatedTableMeta;
    selectFields: Record<string, string>;
    filterKeys: Record<string, ValidatedFilterDescriptor>;
    orderFields: Record<string, string>;
    relations: Record<string, ValidatedRelationMeta>;
};

export type ValidatedInsertSqlPlan = {
    kind: typeof SqlPlanKind.INSERT;
    meta: ValidatedTableMeta;
    writeKeys: string[];
};

export type ValidatedUpdateSqlPlan = {
    kind: typeof SqlPlanKind.UPDATE;
    meta: ValidatedTableMeta;
    writeKeys: string[];
};

export type ValidatedDeleteSqlPlan = {
    kind: typeof SqlPlanKind.DELETE;
    meta: ValidatedTableMeta;
};

export type ValidatedSqlPlan =
    | ValidatedSelectSqlPlan
    | ValidatedInsertSqlPlan
    | ValidatedUpdateSqlPlan
    | ValidatedDeleteSqlPlan;

export interface SQLValidationEngine {
    validate(plan: SelectSqlValidationPlan): ValidatedSelectSqlPlan;
    validate(plan: InsertSqlValidationPlan): ValidatedInsertSqlPlan;
    validate(plan: UpdateSqlValidationPlan): ValidatedUpdateSqlPlan;
    validate(plan: DeleteSqlValidationPlan): ValidatedDeleteSqlPlan;
    validate(plan: SqlValidationPlan): ValidatedSqlPlan;
}
