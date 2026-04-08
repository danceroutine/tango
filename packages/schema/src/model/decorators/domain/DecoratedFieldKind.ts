export const INTERNAL_DECORATED_FIELD_KIND = {
    FOREIGN_KEY: 'foreignKey',
    ONE_TO_ONE: 'oneToOne',
    MANY_TO_MANY: 'manyToMany',
} as const;
export type DecoratedFieldKind = (typeof INTERNAL_DECORATED_FIELD_KIND)[keyof typeof INTERNAL_DECORATED_FIELD_KIND];
