import { describe, it, expect } from 'vitest';
import { PermissionDenied } from '../PermissionDenied';

describe(PermissionDenied, () => {
    it('uses the default permission response details', () => {
        const error = new PermissionDenied();

        expect(error.message).toBe('Permission denied');
        expect(error.status).toBe(403);
        expect(error.name).toBe('PermissionDenied');
    });

    it('preserves a custom error message', () => {
        const error = new PermissionDenied('Admin access required');

        expect(error.message).toBe('Admin access required');
    });
});
