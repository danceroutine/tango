import type { TrustedSqlFragment } from '@danceroutine/tango-core';
import { InternalOperationKind } from './internal/InternalOperationKind';
import type { ColumnSpec } from '../builder/contracts/ColumnSpec';

export type TableCreate = {
    kind: typeof InternalOperationKind.TABLE_CREATE;
    table: string;
    columns: ColumnSpec[];
};

export type TableDrop = {
    kind: typeof InternalOperationKind.TABLE_DROP;
    table: string;
    cascade?: boolean;
};

export type ColumnAdd = {
    kind: typeof InternalOperationKind.COLUMN_ADD;
    table: string;
    column: ColumnSpec;
};

export type ColumnDrop = {
    kind: typeof InternalOperationKind.COLUMN_DROP;
    table: string;
    column: string;
};

export type ColumnAlter = {
    kind: typeof InternalOperationKind.COLUMN_ALTER;
    table: string;
    column: string;
    to: Partial<ColumnSpec>;
};

export type ColumnRename = {
    kind: typeof InternalOperationKind.COLUMN_RENAME;
    table: string;
    from: string;
    to: string;
};

export type IndexCreate = {
    kind: typeof InternalOperationKind.INDEX_CREATE;
    table: string;
    name: string;
    on: string[];
    unique?: boolean;
    where?: TrustedSqlFragment;
    concurrently?: boolean;
};

export type IndexDrop = {
    kind: typeof InternalOperationKind.INDEX_DROP;
    table: string;
    name: string;
    concurrently?: boolean;
};

export type ForeignKeyCreate = {
    kind: typeof InternalOperationKind.FK_CREATE;
    table: string;
    name?: string;
    columns: string[];
    refTable: string;
    refColumns: string[];
    onDelete?: string;
    onUpdate?: string;
    notValid?: boolean;
};

export type ForeignKeyValidate = {
    kind: typeof InternalOperationKind.FK_VALIDATE;
    table: string;
    name: string;
};

export type ForeignKeyDrop = {
    kind: typeof InternalOperationKind.FK_DROP;
    table: string;
    name: string;
};

export type CustomMigrationOperation<TName extends string = string, TArgs extends object = Record<string, unknown>> = {
    kind: 'custom';
    name: TName;
    args: TArgs;
};

export type MigrationOperation =
    | TableCreate
    | TableDrop
    | ColumnAdd
    | ColumnDrop
    | ColumnAlter
    | ColumnRename
    | IndexCreate
    | IndexDrop
    | ForeignKeyCreate
    | ForeignKeyValidate
    | ForeignKeyDrop
    | CustomMigrationOperation;
