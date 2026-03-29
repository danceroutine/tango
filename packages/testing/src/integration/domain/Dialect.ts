export const Dialect = {
    Sqlite: 'sqlite',
    Postgres: 'postgres',
} as const;

export type Dialect = (typeof Dialect)[keyof typeof Dialect];
