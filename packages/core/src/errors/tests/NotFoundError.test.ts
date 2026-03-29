import { describe, it, expect } from 'vitest';
import { NotFoundError } from '../NotFoundError';

describe(NotFoundError, () => {
    it('uses the default not-found response details', () => {
        const error = new NotFoundError();

        expect(error.message).toBe('Resource not found');
        expect(error.status).toBe(404);
        expect(error.name).toBe('NotFoundError');
    });

    it('preserves a custom error message', () => {
        const error = new NotFoundError('User not found');

        expect(error.message).toBe('User not found');
    });
});
