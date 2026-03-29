import { z } from 'zod';
import { hasConstructorName } from './hasConstructorName';

export function isZodDefault(value: unknown): value is z.ZodDefault<z.ZodTypeAny> {
    return hasConstructorName(value, 'ZodDefault');
}
