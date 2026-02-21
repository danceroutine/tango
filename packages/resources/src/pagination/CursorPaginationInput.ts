import { z } from 'zod';

export type CursorPaginationInputValue = {
    limit?: number;
    cursor: string | null;
    ordering?: string;
};

export const CursorPaginationInput: z.ZodType<CursorPaginationInputValue> = z.object({
    limit: z.preprocess(
        (value) => {
            if (value === undefined || value === null || value === '') {
                return undefined;
            }
            const parsed = Number.parseInt(String(value), 10);
            if (!Number.isFinite(parsed) || parsed <= 0) {
                return undefined;
            }
            return parsed;
        },
        z
            .number()
            .int()
            .min(1)
            .transform((value) => Math.min(value, 100))
            .optional()
    ),
    cursor: z.string().nullable().default(null),
    ordering: z.string().optional(),
});
