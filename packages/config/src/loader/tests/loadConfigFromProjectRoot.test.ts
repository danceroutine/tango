import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfigFromProjectRoot } from '../loadConfigFromProjectRoot';

const tempDirs: string[] = [];

function aTempProject(): string {
    const dir = mkdtempSync(join(tmpdir(), 'tango-config-'));
    tempDirs.push(dir);
    return dir;
}

function writeConfig(dir: string, filename: string): void {
    mkdirSync(dirname(join(dir, filename)), { recursive: true });
    writeFileSync(
        join(dir, filename),
        `export default {
    current: 'test',
    environments: {
        development: {
            name: 'development',
            db: { adapter: 'sqlite', filename: 'dev.sqlite' },
            migrations: { dir: 'migrations', online: false },
        },
        test: {
            name: 'test',
            db: { adapter: 'sqlite', filename: 'test.sqlite' },
            migrations: { dir: 'migrations', online: false },
        },
        production: {
            name: 'production',
            db: { adapter: 'sqlite', filename: 'prod.sqlite' },
            migrations: { dir: 'migrations', online: false },
        },
    },
};
`
    );
}

describe(loadConfigFromProjectRoot, () => {
    afterEach(() => {
        while (tempDirs.length > 0) {
            const dir = tempDirs.pop();
            if (dir) {
                rmSync(dir, { recursive: true, force: true });
            }
        }
    });

    it('auto-loads tango.config.ts from the project root', () => {
        const dir = aTempProject();
        writeConfig(dir, 'tango.config.ts');

        const loaded = loadConfigFromProjectRoot({ projectRoot: dir });

        expect(loaded.env).toBe('test');
        expect(loaded.current.db.filename).toBe('test.sqlite');
    });

    it('loads an explicitly configured Tango config path', () => {
        const dir = aTempProject();
        writeConfig(dir, 'config/custom-config.ts');

        const loaded = loadConfigFromProjectRoot({
            projectRoot: dir,
            configPath: './config/custom-config.ts',
        });

        expect(loaded.current.db.filename).toBe('test.sqlite');
    });

    it('throws when no Tango config file can be found', () => {
        const dir = aTempProject();

        expect(() => loadConfigFromProjectRoot({ projectRoot: dir })).toThrow(/unable to find tango config/i);
    });

    it('throws when an explicit Tango config path does not exist', () => {
        const dir = aTempProject();

        expect(() =>
            loadConfigFromProjectRoot({
                projectRoot: dir,
                configPath: './missing/tango.config.ts',
            })
        ).toThrow(/unable to find tango config at/i);
    });

    it('loads from process cwd and supports CommonJS config exports', () => {
        const dir = aTempProject();
        const cwdBefore = process.cwd();

        try {
            writeFileSync(
                join(dir, 'tango.config.cjs'),
                `module.exports = {
    current: 'test',
    environments: {
        development: {
            name: 'development',
            db: { adapter: 'sqlite', filename: 'dev.sqlite' },
            migrations: { dir: 'migrations', online: false },
        },
        test: {
            name: 'test',
            db: { adapter: 'sqlite', filename: 'cwd.sqlite' },
            migrations: { dir: 'migrations', online: false },
        },
        production: {
            name: 'production',
            db: { adapter: 'sqlite', filename: 'prod.sqlite' },
            migrations: { dir: 'migrations', online: false },
        },
    },
};
`
            );
            process.chdir(dir);

            const loaded = loadConfigFromProjectRoot();

            expect(loaded.current.db.filename).toBe('cwd.sqlite');
        } finally {
            process.chdir(cwdBefore);
        }
    });

    it('loads CommonJS configs when the default export key is undefined', () => {
        const dir = aTempProject();

        writeFileSync(
            join(dir, 'tango.config.cjs'),
            `module.exports = {
    default: undefined,
    current: 'test',
    environments: {
        development: {
            name: 'development',
            db: { adapter: 'sqlite', filename: 'dev.sqlite' },
            migrations: { dir: 'migrations', online: false },
        },
        test: {
            name: 'test',
            db: { adapter: 'sqlite', filename: 'fallback.sqlite' },
            migrations: { dir: 'migrations', online: false },
        },
        production: {
            name: 'production',
            db: { adapter: 'sqlite', filename: 'prod.sqlite' },
            migrations: { dir: 'migrations', online: false },
        },
    },
};
`
        );

        const loaded = loadConfigFromProjectRoot({ projectRoot: dir });

        expect(loaded.current.db.filename).toBe('fallback.sqlite');
    });
});
