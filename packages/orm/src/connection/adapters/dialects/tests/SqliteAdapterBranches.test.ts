import { describe, expect, it, vi } from 'vitest';
import { SqliteAdapter } from '../SqliteAdapter';

let requiredModule: unknown = null;

vi.mock('node:module', () => ({
    createRequire: () => (_specifier: string) => requiredModule,
}));

class FakeDatabase {
    pragma(): void {}
}

type SqliteCtor = new (filename: string, options?: unknown) => FakeDatabase;

describe('SqliteAdapter constructor resolution branches', () => {
    it('supports default-export constructors from the better-sqlite3 module', () => {
        requiredModule = { default: FakeDatabase as unknown as SqliteCtor };
        const adapter = new SqliteAdapter();
        const getDatabaseCtor = (adapter as unknown as { getDatabaseCtor(): SqliteCtor }).getDatabaseCtor;
        const ctor = getDatabaseCtor.call(adapter);
        expect(ctor).toBe(FakeDatabase);
    });

    it('throws when better-sqlite3 does not provide a usable constructor', () => {
        requiredModule = { default: 123 };
        const adapter = new SqliteAdapter();
        const getDatabaseCtor = (adapter as unknown as { getDatabaseCtor(): SqliteCtor }).getDatabaseCtor;
        expect(() => getDatabaseCtor.call(adapter)).toThrowError(
            new TypeError('Failed to load better-sqlite3 constructor.')
        );
    });
});
