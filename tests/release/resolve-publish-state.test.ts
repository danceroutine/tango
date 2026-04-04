import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { resolvePublishState, resolveStableInputState } from '../../scripts/release/resolve-publish-state';

type RegistryFixture = {
    highestPublishedStableVersion: string | null;
    publishedVersions: string[];
};

async function createFixtureRepository(packageVersions: Record<string, string>): Promise<string> {
    const rootDir = await mkdtemp(join(tmpdir(), 'tango-release-state-'));

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
        join(rootDir, 'packages/core/package.json'),
        JSON.stringify(
            { name: '@danceroutine/tango-core', version: packageVersions['@danceroutine/tango-core'] },
            null,
            4
        )
    );
    await writeFile(
        join(rootDir, 'packages/schema/package.json'),
        JSON.stringify(
            { name: '@danceroutine/tango-schema', version: packageVersions['@danceroutine/tango-schema'] },
            null,
            4
        )
    );

    return rootDir;
}

function createRegistryReader(fixtures: Record<string, RegistryFixture>) {
    return async (packageName: string) => {
        const fixture = fixtures[packageName];

        if (!fixture) {
            throw new Error(`Missing registry fixture for ${packageName}`);
        }

        return {
            highestPublishedStableVersion: fixture.highestPublishedStableVersion,
            publishedVersions: new Set(fixture.publishedVersions),
        };
    };
}

describe('resolve-publish-state', () => {
    const temporaryDirectories: string[] = [];

    afterEach(async () => {
        await Promise.all(temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
        temporaryDirectories.length = 0;
    });

    it('no-ops when every repo version is already published even if the latest tag is stale', async () => {
        const rootDir = await createFixtureRepository({
            '@danceroutine/tango-core': '1.1.2',
            '@danceroutine/tango-schema': '1.1.2',
        });
        temporaryDirectories.push(rootDir);

        const result = await resolvePublishState(rootDir, {
            readRegistryMetadata: createRegistryReader({
                '@danceroutine/tango-core': {
                    highestPublishedStableVersion: '1.1.1',
                    publishedVersions: ['1.1.1', '1.1.2'],
                },
                '@danceroutine/tango-schema': {
                    highestPublishedStableVersion: '1.1.2',
                    publishedVersions: ['1.1.0', '1.1.2'],
                },
            }),
        });

        expect(result.mode).toBe('noop');
        expect(result.publishablePackages).toEqual([]);
        expect(result.packageStates.map((state) => state.relation)).toEqual(['already-published', 'already-published']);
    });

    it('publishes missing existing packages and first-time unpublished packages', async () => {
        const rootDir = await createFixtureRepository({
            '@danceroutine/tango-core': '1.1.2',
            '@danceroutine/tango-schema': '1.1.2',
        });
        temporaryDirectories.push(rootDir);

        const result = await resolvePublishState(rootDir, {
            readRegistryMetadata: createRegistryReader({
                '@danceroutine/tango-core': {
                    highestPublishedStableVersion: '1.1.1',
                    publishedVersions: ['1.1.0', '1.1.1'],
                },
                '@danceroutine/tango-schema': {
                    highestPublishedStableVersion: null,
                    publishedVersions: [],
                },
            }),
        });

        expect(result.mode).toBe('publish');
        expect(result.publishablePackages).toEqual(['@danceroutine/tango-core', '@danceroutine/tango-schema']);
        expect(result.packageStates.map((state) => state.relation)).toEqual(['publish-missing', 'unpublished-package']);
    });

    it('fails when the registry is ahead of the committed repo version', async () => {
        const rootDir = await createFixtureRepository({
            '@danceroutine/tango-core': '1.1.2',
            '@danceroutine/tango-schema': '1.1.2',
        });
        temporaryDirectories.push(rootDir);

        await expect(
            resolvePublishState(rootDir, {
                readRegistryMetadata: createRegistryReader({
                    '@danceroutine/tango-core': {
                        highestPublishedStableVersion: '1.1.3',
                        publishedVersions: ['1.1.1', '1.1.3'],
                    },
                    '@danceroutine/tango-schema': {
                        highestPublishedStableVersion: '1.1.2',
                        publishedVersions: ['1.1.2'],
                    },
                }),
            })
        ).rejects.toThrow('Registry versions are ahead');
    });

    it('treats a newer published stable version as registry-ahead even when the repo version also exists', async () => {
        const rootDir = await createFixtureRepository({
            '@danceroutine/tango-core': '1.1.2',
            '@danceroutine/tango-schema': '1.1.2',
        });
        temporaryDirectories.push(rootDir);

        await expect(
            resolvePublishState(rootDir, {
                readRegistryMetadata: createRegistryReader({
                    '@danceroutine/tango-core': {
                        highestPublishedStableVersion: '1.1.3',
                        publishedVersions: ['1.1.2', '1.1.3'],
                    },
                    '@danceroutine/tango-schema': {
                        highestPublishedStableVersion: '1.1.2',
                        publishedVersions: ['1.1.2'],
                    },
                }),
            })
        ).rejects.toThrow('Registry versions are ahead');
    });

    it('allows stable input when committed packages match npm or are brand-new unpublished packages', async () => {
        const rootDir = await createFixtureRepository({
            '@danceroutine/tango-core': '1.1.2',
            '@danceroutine/tango-schema': '1.1.2',
        });
        temporaryDirectories.push(rootDir);

        const result = await resolveStableInputState(rootDir, {
            readRegistryMetadata: createRegistryReader({
                '@danceroutine/tango-core': {
                    highestPublishedStableVersion: '1.1.2',
                    publishedVersions: ['1.1.2'],
                },
                '@danceroutine/tango-schema': {
                    highestPublishedStableVersion: null,
                    publishedVersions: [],
                },
            }),
        });

        expect(result.mode).toBe('ready');
        expect(result.packageStates.map((state) => state.relation)).toEqual([
            'already-published',
            'unpublished-package',
        ]);
    });

    it('blocks a new stable version bump when committed main is already ahead of npm', async () => {
        const rootDir = await createFixtureRepository({
            '@danceroutine/tango-core': '1.1.2',
            '@danceroutine/tango-schema': '1.1.2',
        });
        temporaryDirectories.push(rootDir);

        await expect(
            resolveStableInputState(rootDir, {
                readRegistryMetadata: createRegistryReader({
                    '@danceroutine/tango-core': {
                        highestPublishedStableVersion: '1.1.1',
                        publishedVersions: ['1.1.1'],
                    },
                    '@danceroutine/tango-schema': {
                        highestPublishedStableVersion: '1.1.1',
                        publishedVersions: ['1.1.1'],
                    },
                }),
            })
        ).rejects.toThrow('Run stable-recovery before attempting a new stable version bump.');
    });
});
