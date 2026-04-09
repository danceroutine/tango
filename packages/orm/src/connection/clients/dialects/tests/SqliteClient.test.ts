import { describe, expect, it, vi } from 'vitest';
import { SqliteClient } from '../SqliteClient';

function createStmt(reader = false) {
    return {
        reader,
        all: vi.fn(() => [{ id: 1 }]),
        run: vi.fn(() => ({ changes: 1 })),
    };
}

describe(SqliteClient, () => {
    it('executes SELECT/PRAGMA using all() and handles params/no params', async () => {
        const selectStmt = createStmt(true);
        const pragmaStmt = createStmt(true);
        const prepare = vi.fn((sql: string) => {
            if (sql.includes('SELECT')) return selectStmt;
            if (sql.includes('PRAGMA')) return pragmaStmt;
            return createStmt();
        });
        const db = { prepare, close: vi.fn() };
        const client = new SqliteClient(db as unknown as ConstructorParameters<typeof SqliteClient>[0]);

        await expect(client.query('SELECT * FROM users WHERE id = ?', [1])).resolves.toEqual({ rows: [{ id: 1 }] });
        await expect(client.query('PRAGMA table_info(users)')).resolves.toEqual({ rows: [{ id: 1 }] });

        expect(selectStmt.all).toHaveBeenCalledWith(1);
        expect(pragmaStmt.all).toHaveBeenCalledWith();
        expect(SqliteClient.isSqliteClient(client)).toBe(true);
        expect(SqliteClient.isSqliteClient({})).toBe(false);
    });

    it('executes non-select statements with run() and transaction guards', async () => {
        const beginStmt = createStmt();
        const commitStmt = createStmt();
        const rollbackStmt = createStmt();
        const savepointStmt = createStmt();
        const releaseSavepointStmt = createStmt();
        const rollbackSavepointStmt = createStmt();
        const updateStmt = createStmt();
        const deleteStmt = createStmt();
        const prepare = vi.fn((sql: string) => {
            if (sql === 'BEGIN') return beginStmt;
            if (sql === 'COMMIT') return commitStmt;
            if (sql === 'ROLLBACK') return rollbackStmt;
            if (sql === 'SAVEPOINT sp1') return savepointStmt;
            if (sql === 'RELEASE SAVEPOINT sp1') return releaseSavepointStmt;
            if (sql === 'ROLLBACK TO SAVEPOINT sp1') return rollbackSavepointStmt;
            if (sql.startsWith('UPDATE')) return updateStmt;
            return deleteStmt;
        });
        const close = vi.fn();
        const db = { prepare, close };
        const client = new SqliteClient(db as unknown as ConstructorParameters<typeof SqliteClient>[0]);

        await expect(client.query('UPDATE users SET email = ?', ['x'])).resolves.toEqual({ rows: [] });
        await expect(client.query('DELETE FROM users')).resolves.toEqual({ rows: [] });
        await expect(client.query('PRAGMA foreign_keys = ON')).resolves.toEqual({ rows: [] });
        expect(updateStmt.run).toHaveBeenCalledWith('x');
        expect(deleteStmt.run).toHaveBeenCalledWith();

        await client.begin();
        await client.begin();
        await client.createSavepoint('sp1');
        await client.releaseSavepoint('sp1');
        await client.rollbackToSavepoint('sp1');
        await client.commit();
        await client.commit();
        await client.begin();
        await client.rollback();
        await client.rollback();
        await client.close();

        expect(beginStmt.run).toHaveBeenCalledTimes(2);
        expect(savepointStmt.run).toHaveBeenCalledOnce();
        expect(releaseSavepointStmt.run).toHaveBeenCalledOnce();
        expect(rollbackSavepointStmt.run).toHaveBeenCalledOnce();
        expect(commitStmt.run).toHaveBeenCalledTimes(1);
        expect(rollbackStmt.run).toHaveBeenCalledTimes(1);
        expect(close).toHaveBeenCalledOnce();
    });

    it('normalizes boolean and date parameters for sqlite bindings', async () => {
        const insertStmt = createStmt();
        const prepare = vi.fn(() => insertStmt);
        const db = { prepare, close: vi.fn() };
        const client = new SqliteClient(db as unknown as ConstructorParameters<typeof SqliteClient>[0]);

        await expect(
            client.query('INSERT INTO posts (published, featured, createdAt, title) VALUES (?, ?, ?, ?)', [
                true,
                false,
                new Date('2024-01-01T00:00:00.000Z'),
                'hello',
            ])
        ).resolves.toEqual({ rows: [] });

        expect(insertStmt.run).toHaveBeenCalledWith(1, 0, '2024-01-01T00:00:00.000Z', 'hello');
    });
});
