export const InternalMigrationMode = {
    TRANSACTIONAL: 'transactional',
    ONLINE: 'online',
} as const;

export type InternalMigrationMode = (typeof InternalMigrationMode)[keyof typeof InternalMigrationMode];
