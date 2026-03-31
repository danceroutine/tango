export const InternalActionScope = {
    DETAIL: 'detail',
    COLLECTION: 'collection',
} as const;

export type ActionScope = (typeof InternalActionScope)[keyof typeof InternalActionScope];
