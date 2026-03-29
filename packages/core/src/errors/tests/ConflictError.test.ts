import { describe, it, expect } from 'vitest';
import { ConflictError } from '../ConflictError';

describe(ConflictError, () => {
    it('uses the default conflict response details', () => {
        const error = new ConflictError();

        expect(error.message).toBe('Resource conflict');
        expect(error.status).toBe(409);
        expect(error.name).toBe('ConflictError');
    });

    it('preserves a custom error message', () => {
        const error = new ConflictError('Email already exists');

        expect(error.message).toBe('Email already exists');
    });
});
