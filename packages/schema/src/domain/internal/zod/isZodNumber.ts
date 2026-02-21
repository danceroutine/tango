import { z } from 'zod';
import { hasConstructorName } from './hasConstructorName';

export function isZodNumber(value: unknown): value is z.ZodNumber {
    return hasConstructorName(value, 'ZodNumber');
}
