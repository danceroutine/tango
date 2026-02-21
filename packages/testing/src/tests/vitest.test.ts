import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import '../vitest';

describe('toMatchSchema', () => {
    const UserSchema = z.object({
        id: z.number(),
        email: z.string().email(),
        name: z.string(),
    });

    it('passes for data that matches the schema', () => {
        const data = { id: 1, email: 'user@example.com', name: 'Test User' };

        expect(data).toMatchSchema(UserSchema);
    });

    it('fails for data that does not match the schema', () => {
        const data = { id: 1, email: 'not-an-email', name: 'Test User' };

        expect(data).not.toMatchSchema(UserSchema);
    });

    it('fails for data with missing required fields', () => {
        const data = { id: 1, name: 'Test User' };

        expect(data).not.toMatchSchema(UserSchema);
    });

    it('works with objects that have a parse method', () => {
        const customSchema = {
            parse(data: unknown) {
                if (typeof data !== 'string') {
                    throw new TypeError('Expected a string');
                }
                return data;
            },
        };

        expect('hello').toMatchSchema(customSchema);
        expect(42).not.toMatchSchema(customSchema);
    });
});
