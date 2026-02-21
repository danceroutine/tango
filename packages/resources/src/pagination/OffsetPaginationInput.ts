import { z } from 'zod';

export type OffsetPaginationInputValue = {
    limit: number;
    offset: number;
    page?: number;
};

export const OffsetPaginationInput: z.ZodType<OffsetPaginationInputValue> = z.object({
    limit: z.coerce
        .number()
        .int()
        .min(1)
        .default(25)
        .transform((value) => Math.min(value, 100)),
    offset: z.coerce.number().int().min(0).default(0),
    page: z.coerce.number().int().min(1).optional(),
});
