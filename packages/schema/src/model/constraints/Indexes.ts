import type { IndexDef } from '../../domain/index';

export const Indexes = {
    index(on: string[], options?: Omit<IndexDef, 'on'>): IndexDef {
        const suffix = on.join('_');
        return {
            name: options?.name ?? `idx_${suffix}`,
            on,
            unique: options?.unique,
            where: options?.where,
        };
    },
};
