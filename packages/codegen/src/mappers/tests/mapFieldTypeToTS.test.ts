import { describe, expect, it } from 'vitest';
import { mapFieldTypeToTS } from '../fieldType';

describe(mapFieldTypeToTS, () => {
    it('maps known field types to their TypeScript equivalents', () => {
        expect(mapFieldTypeToTS('uuid')).toBe('string');
        expect(mapFieldTypeToTS('jsonb')).toBe('unknown');
    });

    it('returns unknown for unrecognised field types', () => {
        expect(mapFieldTypeToTS('nonsense')).toBe('unknown');
    });
});
