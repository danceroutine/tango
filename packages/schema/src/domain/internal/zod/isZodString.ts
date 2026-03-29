import { z } from 'zod';
import { hasConstructorName } from './hasConstructorName';

export function isZodString(value: unknown): value is z.ZodString {
    return hasConstructorName(value, 'ZodString');
}
