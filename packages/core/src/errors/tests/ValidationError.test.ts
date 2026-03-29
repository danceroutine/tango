import { describe, it, expect } from 'vitest';
import { ValidationError } from '../ValidationError';

describe(ValidationError, () => {
    it('uses the provided validation message and status', () => {
        const error = new ValidationError('Invalid input');

        expect(error.message).toBe('Invalid input');
        expect(error.status).toBe(400);
        expect(error.name).toBe('ValidationError');
    });

    it('includes validation details when provided', () => {
        const details = { email: ['Invalid email format'], name: ['Required'] };
        const error = new ValidationError('Validation failed', details);

        expect(error.details).toEqual(details);
    });

    it('omits validation details when none are provided', () => {
        const error = new ValidationError('Validation failed');

        expect(error.details).toBeUndefined();
    });
});
