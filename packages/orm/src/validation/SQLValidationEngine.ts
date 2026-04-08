import type { RelationMeta, LookupType } from '../query';
import type {
    DeleteSqlValidationPlan,
    InsertSqlValidationPlan,
    SelectSqlValidationPlan,
    SqlValidationPlan,
    UpdateSqlValidationPlan,
} from './SqlValidationPlan';

export type ValidatedRelationMeta = RelationMeta & {
    table: string;
    alias: string;
    sourceKey: string;
    targetKey: string;
    targetColumns: Record<string, string>;
};

export type ValidatedTableMeta = {
    table: string;
    pk: string;
    columns: Record<string, string>;
    relations?: Record<string, ValidatedRelationMeta>;
};

export type ValidatedFilterDescriptor = {
    rawKey: string;
    field: string;
    lookup: LookupType;
    qualifiedColumn: string;
};

export type ValidatedSelectSqlPlan = {
    kind: 'select';
    meta: ValidatedTableMeta;
    selectFields: Record<string, string>;
    filterKeys: Record<string, ValidatedFilterDescriptor>;
    orderFields: Record<string, string>;
    relations: Record<string, ValidatedRelationMeta>;
};

export type ValidatedInsertSqlPlan = {
    kind: 'insert';
    meta: ValidatedTableMeta;
    writeKeys: string[];
};

export type ValidatedUpdateSqlPlan = {
    kind: 'update';
    meta: ValidatedTableMeta;
    writeKeys: string[];
};

export type ValidatedDeleteSqlPlan = {
    kind: 'delete';
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
