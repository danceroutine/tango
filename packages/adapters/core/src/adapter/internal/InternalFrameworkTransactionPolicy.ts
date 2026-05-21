export const InternalFrameworkTransactionPolicy = {
    WRITES: 'writes',
} as const;

export type FrameworkTransactionPolicy =
    (typeof InternalFrameworkTransactionPolicy)[keyof typeof InternalFrameworkTransactionPolicy];
