export const InternalReferentialAction = {
    CASCADE: 'CASCADE',
    SET_NULL: 'SET NULL',
    RESTRICT: 'RESTRICT',
    NO_ACTION: 'NO ACTION',
} as const;

export type InternalReferentialAction = (typeof InternalReferentialAction)[keyof typeof InternalReferentialAction];
