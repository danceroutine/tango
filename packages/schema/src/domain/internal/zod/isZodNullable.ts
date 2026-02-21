import { z } from 'zod';
import { hasConstructorName } from './hasConstructorName';

export function isZodNullable(value: unknown): value is z.ZodNullable<z.ZodTypeAny> {
    return hasConstructorName(value, 'ZodNullable');
}
