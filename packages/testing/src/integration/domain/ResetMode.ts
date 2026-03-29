export const ResetMode = {
    Transaction: 'transaction',
    Truncate: 'truncate',
    DropSchema: 'drop-schema',
} as const;

export type ResetMode = (typeof ResetMode)[keyof typeof ResetMode];
