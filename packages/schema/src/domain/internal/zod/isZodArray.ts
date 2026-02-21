import { z } from 'zod';
import { hasConstructorName } from './hasConstructorName';

export function isZodArray(value: unknown): value is z.ZodArray<z.ZodTypeAny> {
    return hasConstructorName(value, 'ZodArray');
}
