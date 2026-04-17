import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
    collectPendingChangesets,
    parseChangesetContent,
    prependReleaseEntry,
    runReleaseVersioning,
} from '../../scripts/release/version-with-root-changelog';

async function createFixtureRepository(): Promise<string> {
    const rootDir = await mkdtemp(join(tmpdir(), 'tango-release-'));

    await mkdir(join(rootDir, '.changeset'), { recursive: true });
    await mkdir(join(rootDir, 'packages/core'), { recursive: true });
    await mkdir(join(rootDir, 'packages/schema'), { recursive: true });
    await writeFile(
        join(rootDir, '.changeset/config.json'),
        JSON.stringify(
            {
                fixed: [['@danceroutine/tango-core', '@danceroutine/tango-schema']],
            },
            null,
            4
        )
    );
    await writeFile(
        join(rootDir, '.changeset/release.md'),
        `---
"@danceroutine/tango-core": minor
"@danceroutine/tango-schema": minor
---
Add first stable schema primitives.
`
    );
    await writeFile(
        join(rootDir, '.changeset/README.md'),
        `# Changesets

These instructions explain how to write changesets for Tango packages.
`
    );
    await writeFile(
        join(rootDir, 'CHANGELOG.md'),
        `# Changelog

This file is generated from stable release changesets during Tango stable releases. Do not edit manually.

No stable releases have been published yet.
`
    );
    await writeFile(
        join(rootDir, 'packages/core/package.json'),
        JSON.stringify({ name: '@danceroutine/tango-core', version: '0.1.0' }, null, 4)
    );
    await writeFile(
        join(rootDir, 'packages/schema/package.json'),
        JSON.stringify({ name: '@danceroutine/tango-schema', version: '0.1.0' }, null, 4)
    );

    return rootDir;
}

async function writePackageVersion(rootDir: string, packageName: string, version: string): Promise<void> {
    const packagePath =
        packageName === '@danceroutine/tango-core'
            ? join(rootDir, 'packages/core/package.json')
            : join(rootDir, 'packages/schema/package.json');
    const packageJson = JSON.parse(await readFile(packagePath, 'utf8')) as { name: string; version: string };

    packageJson.version = version;

    await writeFile(packagePath, JSON.stringify(packageJson, null, 4));
}

describe(parseChangesetContent, () => {
    it('collects a single package update from a changeset file', () => {
        const note = parseChangesetContent(
            `---
"@danceroutine/tango-core": minor
---
Add a cleaner HTTP result helper.`,
            'alpha.md'
        );

        expect(note.packages).toEqual(['@danceroutine/tango-core']);
        expect(note.summary).toBe('Add a cleaner HTTP result helper.');
        expect(note.bumpTypes).toEqual({
            '@danceroutine/tango-core': 'minor',
        });
    });

    it('collects every package update from a shared changeset file', () => {
        const note = parseChangesetContent(
            `---
"@danceroutine/tango-core": patch
"@danceroutine/tango-resources": minor
---
Improve shared request normalization.`,
            'beta.md'
        );

        expect(note.packages).toEqual(['@danceroutine/tango-core', '@danceroutine/tango-resources']);
        expect(note.summary).toBe('Improve shared request normalization.');
    });
});

describe(prependReleaseEntry, () => {
    it('replaces the bootstrap no-release state', () => {
        const content = prependReleaseEntry(
            `# Changelog

This file is generated from stable release changesets during Tango stable releases. Do not edit manually.

No stable releases have been published yet.
`,
            {
                version: '0.1.0',
                date: '2026-03-14',
                notes: [
                    {
                        filename: 'alpha.md',
                        packages: ['@danceroutine/tango-core'],
                        summary: 'Ship the first core primitive.',
                        bumpTypes: { '@danceroutine/tango-core': 'minor' },
                    },
                ],
            },
            ['@danceroutine/tango-core']
        );

        expect(content).toContain('## 0.1.0 - 2026-03-14');
        expect(content).toContain('Ship the first core primitive.');
        expect(content).not.toContain('No stable releases have been published yet.');
    });

    it('prepends a new entry ahead of existing release entries', () => {
        const content = prependReleaseEntry(
            `# Changelog

This file is generated from stable release changesets during Tango stable releases. Do not edit manually.

## 0.1.0 - 2026-01-01

First stable release.
`,
            {
                version: '0.2.0',
                date: '2026-03-14',
                notes: [
                    {
                        filename: 'beta.md',
                        packages: ['@danceroutine/tango-core', '@danceroutine/tango-resources'],
                        summary: 'Ship resources on top of core.',
                        bumpTypes: {
                            '@danceroutine/tango-core': 'minor',
                            '@danceroutine/tango-resources': 'minor',
                        },
                    },
                ],
            },
            ['@danceroutine/tango-core', '@danceroutine/tango-resources']
        );

        expect(content.indexOf('## 0.2.0 - 2026-03-14')).toBeLessThan(content.indexOf('## 0.1.0 - 2026-01-01'));
    });

    it('preserves authored markdown summaries verbatim', () => {
        const content = prependReleaseEntry(
            `# Changelog

This file is generated from stable release changesets during Tango stable releases. Do not edit manually.

No stable releases have been published yet.
`,
            {
                version: '0.2.0',
                date: '2026-03-14',
                notes: [
                    {
                        filename: 'gamma.md',
                        packages: ['@danceroutine/tango-core'],
                        summary: `Core querying now supports richer relation hydration.

- Add nested eager-loading support.

Previously:

\`\`\`ts
const posts = await PostModel.objects.query().fetch();
\`\`\`
`,
                        bumpTypes: { '@danceroutine/tango-core': 'minor' },
                    },
                ],
            },
            ['@danceroutine/tango-core']
        );

        expect(content).toContain('Core querying now supports richer relation hydration.');
        expect(content).toContain('- Add nested eager-loading support.');
        expect(content).toContain('```ts');
        expect(content).not.toContain('Affected packages:');
    });
});

describe(runReleaseVersioning, () => {
    const temporaryDirectories: string[] = [];

    afterEach(async () => {
        await Promise.all(temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
        temporaryDirectories.length = 0;
    });

    it('updates versions, lockfile, and the root changelog in one pass', async () => {
        const rootDir = await createFixtureRepository();
        temporaryDirectories.push(rootDir);

        await runReleaseVersioning({
            rootDir,
            date: '2026-03-14',
            runCommand: async (_command, args, commandOptions) => {
                if (args.join(' ') === 'changeset version') {
                    await writePackageVersion(commandOptions.cwd, '@danceroutine/tango-core', '0.2.0');
                    await writePackageVersion(commandOptions.cwd, '@danceroutine/tango-schema', '0.2.0');
                    return;
                }

                if (args.join(' ') === 'install --lockfile-only') {
                    await writeFile(join(commandOptions.cwd, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
                    return;
                }

                throw new Error(`Unexpected command: ${args.join(' ')}`);
            },
        });

        const changelog = await readFile(join(rootDir, 'CHANGELOG.md'), 'utf8');
        const corePackage = JSON.parse(await readFile(join(rootDir, 'packages/core/package.json'), 'utf8')) as {
            version: string;
        };
        const schemaPackage = JSON.parse(await readFile(join(rootDir, 'packages/schema/package.json'), 'utf8')) as {
            version: string;
        };
        const lockfile = await readFile(join(rootDir, 'pnpm-lock.yaml'), 'utf8');

        expect(corePackage.version).toBe('0.2.0');
        expect(schemaPackage.version).toBe('0.2.0');
        expect(lockfile).toContain('lockfileVersion: 9.0');
        expect(changelog).toContain('## 0.2.0 - 2026-03-14');
        expect(changelog).toContain('Add first stable schema primitives.');
        expect(changelog).not.toContain('Affected packages:');
    });

    it('collects pending changesets from disk in filename order', async () => {
        const rootDir = await createFixtureRepository();
        temporaryDirectories.push(rootDir);

        await writeFile(
            join(rootDir, '.changeset/alpha.md'),
            `---
"@danceroutine/tango-core": patch
---
Refine core response helpers.
`
        );
        await writeFile(
            join(rootDir, '.changeset/beta.md'),
            `---
"@danceroutine/tango-schema": patch
---
Refine schema defaults.
`
        );

        const notes = await collectPendingChangesets(rootDir);

        expect(notes.map((note) => note.filename)).toEqual(['alpha.md', 'beta.md', 'release.md']);
    });

    it('ignores the changeset README when collecting pending changesets', async () => {
        const rootDir = await createFixtureRepository();
        temporaryDirectories.push(rootDir);

        const notes = await collectPendingChangesets(rootDir);

        expect(notes.map((note) => note.filename)).toEqual(['release.md']);
    });
});
