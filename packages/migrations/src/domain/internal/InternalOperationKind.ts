export const InternalOperationKind = {
    TABLE_CREATE: 'table.create',
    TABLE_DROP: 'table.drop',
    COLUMN_ADD: 'column.add',
    COLUMN_DROP: 'column.drop',
    COLUMN_ALTER: 'column.alter',
    COLUMN_RENAME: 'column.rename',
    INDEX_CREATE: 'index.create',
    INDEX_DROP: 'index.drop',
    FK_CREATE: 'fk.create',
    FK_VALIDATE: 'fk.validate',
    FK_DROP: 'fk.drop',
} as const;

export type InternalOperationKind = (typeof InternalOperationKind)[keyof typeof InternalOperationKind];
