export const InternalColumnType = {
    SERIAL: 'serial',
    INT: 'int',
    BIGINT: 'bigint',
    TEXT: 'text',
    BOOL: 'bool',
    TIMESTAMPTZ: 'timestamptz',
    JSONB: 'jsonb',
    UUID: 'uuid',
} as const;

export type InternalColumnType = (typeof InternalColumnType)[keyof typeof InternalColumnType];
