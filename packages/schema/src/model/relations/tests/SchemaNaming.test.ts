import { describe, expect, it } from 'vitest';
import * as SchemaNaming from '../SchemaNaming';

describe(SchemaNaming.decapitalizeModelName, () => {
    it('leaves an empty string unchanged', () => {
        expect(SchemaNaming.decapitalizeModelName('')).toBe('');
    });
});

describe(SchemaNaming.toSnakeCase, () => {
    it('converts pascal case to snake_case', () => {
        expect(SchemaNaming.toSnakeCase('UserProfile')).toBe('user_profile');
    });
});

describe(SchemaNaming.pluralize, () => {
    it('returns a plural form for PascalCase input', () => {
        expect(SchemaNaming.pluralize('UserProfile')).toBe('UserProfiles');
    });
});

describe(SchemaNaming.deriveTableName, () => {
    it('converts pascal case to a plural snake_case table name', () => {
        expect(SchemaNaming.deriveTableName('UserProfile')).toBe('user_profiles');
    });
});
