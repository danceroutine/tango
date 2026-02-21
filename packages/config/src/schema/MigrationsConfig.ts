import { z } from 'zod';

export type MigrationsConfig = {
    dir: string;
    online: boolean;
    /** When false, `tango migrate` exits without applying. Default `true`. */
    autoApply: boolean;
};

export const MigrationsConfigSchema: z.ZodTypeAny = z.object({
    dir: z.string().default('migrations'),
    online: z.boolean().default(false),
    autoApply: z.boolean().default(true),
});
