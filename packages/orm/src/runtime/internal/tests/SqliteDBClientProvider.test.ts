import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SqliteDBClientProvider } from '../SqliteDBClientProvider';

async function createFilename(): Promise<{ dir: string; filename: string }> {
    const dir = await mkdtemp(join(tmpdir(), 'tango-sqlite-provider-'));
    return { dir, filename: join(dir, 'db.sqlite') };
}

describe(SqliteDBClientProvider, () => {
    const dirs: string[] = [];

    afterEach(async () => {
        await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
    });

    it('runs file-backed autocommit queries and transaction leases against the same database', async () => {
        const { dir, filename } = await createFilename();
        dirs.push(dir);
        const provider = new SqliteDBClientProvider({ filename });

        await provider.query('CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT NOT NULL)');
        const lease = await provider.leaseTransactionClient();
        await lease.client.begin();
        await lease.client.query('INSERT INTO posts (id, title) VALUES (?, ?)', [1, 'first']);
        await lease.client.commit();
        await lease.release();
        await lease.release();

        await expect(provider.query<{ id: number }>('SELECT id FROM posts ORDER BY id')).resolves.toEqual({
            rows: [{ id: 1 }],
        });

        await expect(provider.reset()).resolves.toBeUndefined();
    });

    it('rejects transaction leasing for :memory: sqlite', async () => {
        const provider = new SqliteDBClientProvider({ filename: ':memory:' });

        await expect(provider.leaseTransactionClient()).rejects.toThrow(/file-backed SQLite/);
        await provider.reset();
    });

    it('falls back to :memory: when sqlite filename is empty', async () => {
        const provider = new SqliteDBClientProvider({ filename: '' });

        await expect(provider.leaseTransactionClient()).rejects.toThrow(/file-backed SQLite/);
        await provider.reset();
    });

    it('rejects reset while a transaction lease is still active', async () => {
        const { dir, filename } = await createFilename();
        dirs.push(dir);
        const provider = new SqliteDBClientProvider({ filename });
        const lease = await provider.leaseTransactionClient();

        await expect(provider.reset()).rejects.toThrow(/transaction leases are still active/i);

        await lease.release();
        await expect(provider.reset()).resolves.toBeUndefined();
    });

    it('serializes autocommit queries behind an active transaction lease', async () => {
        const { dir, filename } = await createFilename();
        dirs.push(dir);
        const provider = new SqliteDBClientProvider({ filename });

        await provider.query('CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT NOT NULL)');
        const lease = await provider.leaseTransactionClient();
        await lease.client.begin();

        let insertResolved = false;
        const insertPromise = provider.query('INSERT INTO posts (id, title) VALUES (?, ?)', [2, 'queued']).then(() => {
            insertResolved = true;
        });

        await Promise.resolve();
        expect(insertResolved).toBe(false);

        await lease.client.query('INSERT INTO posts (id, title) VALUES (?, ?)', [1, 'inside tx']);
        await lease.client.commit();
        await lease.release();
        await insertPromise;

        await expect(provider.query<{ id: number }>('SELECT id FROM posts ORDER BY id')).resolves.toEqual({
            rows: [{ id: 1 }, { id: 2 }],
        });

        await provider.reset();
    });

    it('releases the exclusive lease when transaction client creation fails', async () => {
        const { dir, filename } = await createFilename();
        dirs.push(dir);
        const provider = new SqliteDBClientProvider({ filename });
        const openClient = vi.spyOn(
            SqliteDBClientProvider.prototype as unknown as { openClient: (filename: string) => unknown },
            'openClient'
        );
        openClient.mockImplementationOnce(() => {
            throw new Error('boom');
        });

        await expect(provider.leaseTransactionClient()).rejects.toThrow('boom');

        openClient.mockRestore();
        const lease = await provider.leaseTransactionClient();
        await lease.release();
        await provider.reset();
    });
});
