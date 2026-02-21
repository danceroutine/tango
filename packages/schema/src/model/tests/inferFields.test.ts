import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { inferFieldsFromSchema } from '../inferFields';
import { t } from '../index';
import { isDate, isZodArray, isZodObject } from '../../domain/internal/zod/index';

describe(inferFieldsFromSchema, () => {
    it('maps object and array fields to jsonb columns', () => {
        const fields = inferFieldsFromSchema(
            z.object({
                meta: z.object({ key: z.string() }),
                tags: z.array(z.string()),
            })
        );

        expect(fields).toEqual([
            { name: 'meta', type: 'jsonb', notNull: true, default: undefined },
            { name: 'tags', type: 'jsonb', notNull: true, default: undefined },
        ]);
    });

    it('skips unsupported zod field types', () => {
        const fields = inferFieldsFromSchema(
            z.object({
                id: z.number().int(),
                payload: z.union([z.string(), z.number()]),
            })
        );

        expect(fields).toHaveLength(1);
        expect(fields[0]).toMatchObject({ name: 'id', type: 'int', notNull: true });
    });

    it('maps non-integer numbers to bigint columns', () => {
        const fields = inferFieldsFromSchema(
            z.object({
                amount: z.number(),
            })
        );

        expect(fields).toEqual([{ name: 'amount', type: 'bigint', notNull: true, default: undefined }]);
    });

    it('does not coerce unsupported default value types', () => {
        const fields = inferFieldsFromSchema(
            z.object({
                enabled: z.boolean().default(true),
            })
        );

        expect(fields).toEqual([{ name: 'enabled', type: 'bool', notNull: true, default: undefined }]);
    });

    it('handles zod number defs without checks by falling back to bigint', () => {
        const amount = z.number();
        (amount as unknown as { _zod: { def: { checks?: unknown } } })._zod.def.checks = undefined;

        const fields = inferFieldsFromSchema(z.object({ amount }));

        expect(fields).toEqual([{ name: 'amount', type: 'bigint', notNull: true, default: undefined }]);
    });

    it('merges tango field metadata into inferred columns', () => {
        const fields = inferFieldsFromSchema(
            z.object({
                id: t.primaryKey(z.number().int()),
                email: t.unique(t.dbColumn(z.string(), 'email_address')),
                createdAt: t.default(t.notNull(z.date()), { now: true }),
            })
        );

        expect(fields).toEqual([
            {
                name: 'id',
                type: 'int',
                notNull: true,
                default: undefined,
                primaryKey: true,
            },
            {
                name: 'email_address',
                type: 'text',
                notNull: true,
                default: undefined,
                unique: true,
            },
            {
                name: 'createdAt',
                type: 'timestamptz',
                notNull: true,
                default: { now: true },
            },
        ]);
    });
});

describe('zod guards', () => {
    it('identifies object and array zod types', () => {
        expect(isZodObject(z.object({ a: z.string() }))).toBe(true);
        expect(isZodArray(z.array(z.string()))).toBe(true);
    });

    it('rejects non-date values in isDate guard', () => {
        expect(isDate('2024-01-01')).toBe(false);
    });
});
