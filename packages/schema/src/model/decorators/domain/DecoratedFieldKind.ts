export const InternalDecoratedFieldKind = {
    FOREIGN_KEY: 'foreignKey',
    ONE_TO_ONE: 'oneToOne',
    MANY_TO_MANY: 'manyToMany',
} as const;
export type DecoratedFieldKind = (typeof InternalDecoratedFieldKind)[keyof typeof InternalDecoratedFieldKind];
