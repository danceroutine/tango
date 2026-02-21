import { z } from 'zod';
import { hasConstructorName } from './hasConstructorName';

export function isZodOptional(value: unknown): value is z.ZodOptional<z.ZodTypeAny> {
    return hasConstructorName(value, 'ZodOptional');
}
