import { describe, expect, it } from 'vitest';
import { MultipleObjectsReturned } from '../MultipleObjectsReturned';

describe(MultipleObjectsReturned, () => {
    it('is a 409 tango error and can be type-guarded', () => {
        const error = new MultipleObjectsReturned('x');
        expect(error.name).toBe('MultipleObjectsReturned');
        expect(error.status).toBe(409);
        expect(error.toErrorEnvelope()).toEqual({
            error: { code: 'multiple_objects_returned', message: 'x', details: undefined },
        });
        expect(MultipleObjectsReturned.isMultipleObjectsReturned(error)).toBe(true);
        expect(MultipleObjectsReturned.isMultipleObjectsReturned({})).toBe(false);
    });
});
