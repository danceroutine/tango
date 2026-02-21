import { z } from 'zod';
import { InternalAdapterName } from './internal/InternalAdapterName';

export type AdapterName = (typeof InternalAdapterName)[keyof typeof InternalAdapterName];

export const AdapterNameSchema: z.ZodTypeAny = z.enum(Object.values(InternalAdapterName));
