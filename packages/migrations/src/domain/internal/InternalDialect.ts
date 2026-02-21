export const InternalDialect = {
    POSTGRES: 'postgres',
    SQLITE: 'sqlite',
} as const;

export type InternalDialect = (typeof InternalDialect)[keyof typeof InternalDialect];
