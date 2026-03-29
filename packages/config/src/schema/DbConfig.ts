import { z } from 'zod';
import { AdapterNameSchema, type AdapterName } from './AdapterName';

export type DbConfig = {
    adapter: AdapterName;
    url?: string;
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    filename?: string;
    maxConnections: number;
};

export const DbConfigSchema: z.ZodTypeAny = z.object({
    adapter: AdapterNameSchema,
    url: z.string().optional(),
    host: z.string().optional(),
    port: z.coerce.number().optional(),
    database: z.string().optional(),
    user: z.string().optional(),
    password: z.string().optional(),
    filename: z.string().optional(),
    maxConnections: z.coerce.number().default(10),
});
