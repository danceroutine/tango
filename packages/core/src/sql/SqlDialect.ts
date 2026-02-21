export const INTERNAL_SQL_DIALECT = {
    POSTGRES: 'postgres',
    SQLITE: 'sqlite',
} as const;

export type SqlDialect = (typeof INTERNAL_SQL_DIALECT)[keyof typeof INTERNAL_SQL_DIALECT];
