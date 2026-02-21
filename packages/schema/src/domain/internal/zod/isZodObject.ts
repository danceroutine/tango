import { z } from 'zod';
import { hasConstructorName } from './hasConstructorName';

export function isZodObject(value: unknown): value is z.ZodObject<z.ZodRawShape> {
    return hasConstructorName(value, 'ZodObject');
}
