import { describe, expect, it } from 'vitest';
import { generateModelInterface } from '../generateModelInterface';

describe(generateModelInterface, () => {
    it('generates model interfaces with optional defaulted fields', () => {
        const out = generateModelInterface({
            name: 'User',
            fields: {
                id: { type: 'uuid', primaryKey: true },
                email: { type: 'text' },
                createdAt: { type: 'timestamptz', default: 'now()' },
            },
        });

        expect(out).toContain('export interface User');
        expect(out).toContain('id: string;');
        expect(out).toContain('email: string;');
        expect(out).toContain('createdAt?: Date;');
    });
});
