import { z } from 'zod';
import { hasConstructorName } from './hasConstructorName';

export function isZodDate(value: unknown): value is z.ZodDate {
    return hasConstructorName(value, 'ZodDate');
}
