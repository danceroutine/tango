export const InternalSqlDialect = {
    POSTGRES: 'postgres',
    SQLITE: 'sqlite',
} as const;

export type SqlDialect = (typeof InternalSqlDialect)[keyof typeof InternalSqlDialect];
