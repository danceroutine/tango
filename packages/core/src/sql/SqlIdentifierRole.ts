export const INTERNAL_SQL_IDENTIFIER_ROLE = {
    TABLE: 'table',
    COLUMN: 'column',
    PRIMARY_KEY: 'primaryKey',
    INDEX: 'index',
    ALIAS: 'alias',
    CONSTRAINT: 'constraint',
    SCHEMA: 'schema',
    RELATION_TABLE: 'relationTable',
    RELATION_FOREIGN_KEY: 'relationForeignKey',
    RELATION_TARGET_PRIMARY_KEY: 'relationTargetPrimaryKey',
} as const;

export type SqlIdentifierRole = (typeof INTERNAL_SQL_IDENTIFIER_ROLE)[keyof typeof INTERNAL_SQL_IDENTIFIER_ROLE];
