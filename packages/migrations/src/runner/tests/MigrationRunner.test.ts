import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { aDBClient } from '@danceroutine/tango-testing';
import { MigrationRunner } from '../MigrationRunner';
import { InternalDialect } from '../../domain/internal/InternalDialect';
import type { CompilerStrategy } from '../../strategies/CompilerStrategy';

const DOMAIN_IMPORT = '../src/domain/index.ts';

async function createTempMigrations(files: Record<string, string>): Promise<string> {
    const dir = await mkdtemp(join(process.cwd(), '.tmp-tango-migrations-runner-'));
    await Promise.all(Object.entries(files).map(([name, source]) => writeFile(join(dir, name), source, 'utf8')));
    return dir;
}

function makeClient(queryImpl?: (sql: string, params?: readonly unknown[]) => Promise<{ rows: unknown[] }>) {
    return aDBClient({
        query: vi.fn(async (sql: string, params?: readonly unknown[]) => {
            if (queryImpl) {
                return queryImpl(sql, params);
            }
            if (sql.includes('SELECT id FROM')) {
                return { rows: [] };
            }
            return { rows: [] };
        }),
        close: vi.fn(async () => {}),
    });
}

function strategyReturning(sql: string): CompilerStrategy {
    return {
        prepareOperations: vi.fn((_dialect, operations) => operations),
        compile: vi.fn(() => [{ sql, params: [] }]),
    } as unknown as CompilerStrategy;
}

describe(MigrationRunner, () => {
    const tempDirs: string[] = [];

    afterEach(async () => {
        await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
        tempDirs.length = 0;
    });

    it('runs migrations with transactional and data steps', async () => {
        const dir = await createTempMigrations({
            '001_users.ts': `import { Migration } from '${DOMAIN_IMPORT}';\nMigration.isMigration({});\nMigration.isMigrationConstructor({});\nexport default class M1 extends Migration { id='001_users'; mode='offline'; async up(m){ m.run({ kind: 'table.drop', table: 'users' }); m.data(async (ctx)=>{ await ctx.query('SELECT 1'); }); } async down(m){ m.run({ kind: 'table.drop', table: 'users' }); } }`,
            '002_posts.ts': `import { Migration } from '${DOMAIN_IMPORT}';\nexport default new (class M2 extends Migration { id='002_posts'; async up(m){ m.run({ kind: 'table.drop', table: 'posts' }); } async down(){} })();`,
        });
        tempDirs.push(dir);

        const client = makeClient(async (sql) => {
            if (sql.includes('SELECT id FROM')) return { rows: [] };
            return { rows: [] };
        });
        const runner = new MigrationRunner(
            client,
            InternalDialect.POSTGRES,
            dir,
            strategyReturning('SELECT 1') as CompilerStrategy
        );

        expect(MigrationRunner.isMigrationRunner(runner)).toBe(true);
        expect(MigrationRunner.isMigrationRunner({})).toBe(false);

        await runner.apply();

        const sqlCalls = vi.mocked(client.query).mock.calls as Array<[string, ...unknown[]]>;
        const sqls = sqlCalls.map((call) => String(call[0]));
        expect(sqls.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS "_tango_migrations"'))).toBe(true);
        expect(sqls).toContain('BEGIN');
        expect(sqls).toContain('COMMIT');
        expect(sqls.some((sql) => sql.includes('INSERT INTO "_tango_migrations"'))).toBe(true);
        expect(sqls).toContain('SELECT 1');
    });

    it('rolls back postgres transaction when migration execution fails', async () => {
        const dir = await createTempMigrations({
            '001_fail.ts': `import { Migration } from '${DOMAIN_IMPORT}';\nexport default class MFail extends Migration { id='001_fail'; mode='offline'; up(m){ m.run({ kind: 'table.drop', table: 'users' }); } down(){} }`,
        });
        tempDirs.push(dir);

        const client = makeClient(async (sql) => {
            if (sql.includes('SELECT id FROM')) return { rows: [] };
            if (sql === 'SELECT FAIL') throw new Error('boom');
            return { rows: [] };
        });
        const strategy = strategyReturning('SELECT FAIL');
        const runner = new MigrationRunner(client, InternalDialect.POSTGRES, dir, strategy);

        await expect(runner.apply()).rejects.toThrow('boom');
        expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('does not issue rollback for sqlite failure paths', async () => {
        const dir = await createTempMigrations({
            '001_fail_sqlite.ts': `import { Migration } from '${DOMAIN_IMPORT}';\nexport default class MFailSqlite extends Migration { id='001_fail_sqlite'; mode='offline'; up(m){ m.run({ kind: 'table.drop', table: 'users' }); } down(){} }`,
        });
        tempDirs.push(dir);

        const client = makeClient(async (sql) => {
            if (sql.includes('SELECT id FROM')) return { rows: [] };
            if (sql === 'SELECT FAIL SQLITE') throw new Error('sqlite-fail');
            return { rows: [] };
        });
        const runner = new MigrationRunner(
            client,
            InternalDialect.SQLITE,
            dir,
            strategyReturning('SELECT FAIL SQLITE')
        );

        await expect(runner.apply()).rejects.toThrow('sqlite-fail');
        const sqlCalls = vi.mocked(client.query).mock.calls as Array<[string, ...unknown[]]>;
        expect(sqlCalls.some((call) => String(call[0]) === 'ROLLBACK')).toBe(false);
    });

    it('supports toId cutoffs and skips already applied ids', async () => {
        const dir = await createTempMigrations({
            '001_one.ts': `import { Migration } from '${DOMAIN_IMPORT}';\nexport default class M1 extends Migration { id='001_one'; up(m){ m.run({ kind: 'table.drop', table: 'a' }); } down(){} }`,
            '002_two.ts': `import { Migration } from '${DOMAIN_IMPORT}';\nexport default class M2 extends Migration { id='002_two'; up(m){ m.run({ kind: 'table.drop', table: 'b' }); } down(){} }`,
        });
        tempDirs.push(dir);

        const client = makeClient(async (sql) => {
            if (sql.includes('SELECT id FROM')) return { rows: [{ id: '001_one' }] };
            return { rows: [] };
        });
        const runner = new MigrationRunner(client, InternalDialect.SQLITE, dir, strategyReturning('SELECT 1'));

        await runner.apply('001_one');
        const sqlCalls = vi.mocked(client.query).mock.calls as Array<[string, ...unknown[]]>;
        const inserts = sqlCalls.filter((call) => String(call[0]).includes('INSERT INTO _tango_migrations'));
        expect(inserts).toHaveLength(0);
    });

    it('generates plans, statuses, and validates invalid migration modules', async () => {
        const validDir = await createTempMigrations({
            '001_plan.ts': `import { Migration } from '${DOMAIN_IMPORT}';\nexport default class MPlan extends Migration { id='001_plan'; up(m){ m.run({ kind: 'table.drop', table: 'users' }); m.data(async()=>{}); } down(){} }`,
        });
        tempDirs.push(validDir);
        const client = makeClient(async (sql) => {
            if (sql.includes('SELECT id FROM')) return { rows: [{ id: '001_plan' }] };
            return { rows: [] };
        });
        const runner = new MigrationRunner(
            client,
            InternalDialect.SQLITE,
            validDir,
            strategyReturning('DROP TABLE users')
        );
        await expect(runner.plan()).resolves.toContain('-- (data step present)');
        await expect(runner.status()).resolves.toEqual([{ id: '001_plan', applied: true }]);

        const invalidDir = await createTempMigrations({ '001_invalid.js': 'export default { nope: true };' });
        tempDirs.push(invalidDir);
        const invalidRunner = new MigrationRunner(
            client,
            InternalDialect.SQLITE,
            invalidDir,
            strategyReturning('SELECT 1')
        );
        await expect(invalidRunner.plan()).rejects.toThrow('Invalid migration module');
    });

    it('loads typescript migration modules directly', async () => {
        const dir = await createTempMigrations({
            '001_ts.ts': `import { Migration } from '${DOMAIN_IMPORT}'; export default class MTs extends Migration { id='001_ts'; up(m){ m.run({ kind: 'table.drop', table: 'users' }); } down(){} }`,
        });
        tempDirs.push(dir);

        const client = makeClient(async (sql) => {
            if (sql.includes('SELECT id FROM')) return { rows: [] };
            return { rows: [] };
        });
        const runner = new MigrationRunner(client, InternalDialect.SQLITE, dir, strategyReturning('SELECT 1'));

        await expect(runner.plan()).resolves.toContain('# 001_ts');
    });

    it('wraps migration module load errors with file context', async () => {
        const dir = await createTempMigrations({
            '001_broken.js': `import 'definitely-missing-module'; export default {};`,
        });
        tempDirs.push(dir);

        const client = makeClient(async (sql) => {
            if (sql.includes('SELECT id FROM')) return { rows: [] };
            return { rows: [] };
        });
        const runner = new MigrationRunner(client, InternalDialect.SQLITE, dir, strategyReturning('SELECT 1'));

        await expect(runner.plan()).rejects.toThrow("Failed to load migration module '001_broken.js'");
    });

    it('wraps non-Error migration load throws with file context', async () => {
        const dir = await createTempMigrations({
            '001_broken_string.js': `throw 'string-load-failure'; export default {};`,
        });
        tempDirs.push(dir);

        const client = makeClient(async (sql) => {
            if (sql.includes('SELECT id FROM')) return { rows: [] };
            return { rows: [] };
        });
        const runner = new MigrationRunner(client, InternalDialect.SQLITE, dir, strategyReturning('SELECT 1'));

        await expect(runner.plan()).rejects.toThrow(
            "Failed to load migration module '001_broken_string.js': string-load-failure"
        );
    });
});
