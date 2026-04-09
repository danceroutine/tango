import { afterEach, describe, expect, it, vi } from 'vitest';

describe('SqliteDBClientProvider constructor branches', () => {
    afterEach(() => {
        vi.resetModules();
        vi.unmock('node:module');
    });

    it('accepts a default-export constructor from createRequire', async () => {
        class FakeDatabase {
            pragma(): void {}
            prepare() {
                return {
                    reader: false,
                    all: vi.fn(() => []),
                    run: vi.fn(() => undefined),
                };
            }
            close(): void {}
        }

        vi.doMock('node:module', () => ({
            createRequire: () => () => ({ default: FakeDatabase }),
        }));

        const { SqliteDBClientProvider } = await import('../SqliteDBClientProvider');
        const provider = new SqliteDBClientProvider({ filename: 'fake.sqlite' });
        await expect(provider.reset()).resolves.toBeUndefined();
    });

    it('throws when createRequire does not expose a usable constructor', async () => {
        vi.doMock('node:module', () => ({
            createRequire: () => () => ({}),
        }));

        const { SqliteDBClientProvider } = await import('../SqliteDBClientProvider');
        expect(() => new SqliteDBClientProvider({ filename: 'fake.sqlite' })).toThrow(/Failed to load better-sqlite3/);
    });
});
