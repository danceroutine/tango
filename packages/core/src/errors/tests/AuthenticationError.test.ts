import { describe, it, expect } from 'vitest';
import { AuthenticationError } from '../AuthenticationError';

describe(AuthenticationError, () => {
    it('uses the default authentication response details', () => {
        const error = new AuthenticationError();

        expect(error.message).toBe('Authentication required');
        expect(error.status).toBe(401);
        expect(error.name).toBe('AuthenticationError');
    });

    it('preserves a custom error message', () => {
        const error = new AuthenticationError('Invalid credentials');

        expect(error.message).toBe('Invalid credentials');
    });
});
