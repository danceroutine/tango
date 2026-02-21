import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { runInitCommand } from '../runInitCommand';
import * as tangoCore from '@danceroutine/tango-core';

describe(runInitCommand, () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('uses the existing package name when package.json is present', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'tango-codegen-run-init-'));

        try {
            await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'already-named-app' }, null, 2), 'utf8');

            await runInitCommand({
                framework: 'next',
                path: dir,
                dialect: 'sqlite',
                skipExisting: true,
                force: false,
            });

            const tangoConfig = await readFile(join(dir, 'tango.config.ts'), 'utf8');
            expect(tangoConfig).toContain('./.data/already-named-app.sqlite');
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it('falls back to the directory basename when package.json has an empty name', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'tango-codegen-run-init-empty-name-'));

        try {
            await writeFile(join(dir, 'package.json'), JSON.stringify({ name: '' }, null, 2), 'utf8');

            await runInitCommand({
                framework: 'next',
                path: dir,
                dialect: 'sqlite',
                skipExisting: true,
                force: false,
            });

            const tangoConfig = await readFile(join(dir, 'tango.config.ts'), 'utf8');
            expect(tangoConfig).toContain(`./.data/${basename(dir)}.sqlite`);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it.each([
        ['pnpm-lock.yaml', 'pnpm add'],
        ['package-lock.json', 'npm install'],
        ['yarn.lock', 'yarn add'],
        ['bun.lockb', 'bun add'],
        ['bun.lock', 'bun add'],
    ] as const)('derives %s as the package manager for install instructions', async (lockfile, installPrefix) => {
        const dir = await mkdtemp(join(tmpdir(), 'tango-codegen-run-init-lockfile-'));
        const logger = { info: vi.fn() };
        vi.spyOn(tangoCore, 'getLogger').mockReturnValue(logger as never);

        try {
            await writeFile(join(dir, lockfile), '', 'utf8');

            await runInitCommand({
                framework: 'next',
                path: dir,
                dialect: 'sqlite',
                skipExisting: true,
                force: false,
            });

            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`Install dependencies: ${installPrefix}`));
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
