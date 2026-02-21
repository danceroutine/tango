import { z } from 'zod';
import { hasConstructorName } from './hasConstructorName';

export function isZodBoolean(value: unknown): value is z.ZodBoolean {
    return hasConstructorName(value, 'ZodBoolean');
}
