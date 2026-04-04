import { appendFile, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

type ReleaseConfig = {
    fixed?: string[][];
    ignore?: string[];
};

type PackageEntry = {
    name: string;
    version: string;
    private?: boolean;
};

type PublishMode = 'noop' | 'publish';

type PackagePublishState =
    | {
          packageName: string;
          repoVersion: string;
          registryVersion: string | null;
          relation: 'equal' | 'repo-ahead';
      }
    | {
          packageName: string;
          repoVersion: string;
          registryVersion: string;
          relation: 'registry-ahead';
      };

type ParsedVersion = {
    major: number;
    minor: number;
    patch: number;
    prerelease: string[];
};

const CHANGESET_CONFIG_PATH = '.changeset/config.json';
const PACKAGES_DIRECTORY = 'packages';

export async function resolvePublishState(rootDir: string): Promise<{
    mode: PublishMode;
    publishablePackages: string[];
    packageStates: PackagePublishState[];
}> {
    const releaseConfig = await loadReleaseConfig(rootDir);
    const fixedPackages = releaseConfig.fixed?.[0];

    if (!fixedPackages || fixedPackages.length === 0) {
        throw new Error('Expected .changeset/config.json to declare a fixed release group.');
    }

    const ignoredPackages = new Set(releaseConfig.ignore ?? []);
    const releasablePackages = fixedPackages.filter((packageName) => !ignoredPackages.has(packageName));
    const packageEntries = await loadPackageEntries(join(rootDir, PACKAGES_DIRECTORY));
    const packageStates: PackagePublishState[] = [];

    for (const packageName of releasablePackages) {
        const packageEntry = packageEntries.get(packageName);

        if (!packageEntry) {
            throw new Error(`Could not find package.json for release package "${packageName}".`);
        }

        const registryVersion = await fetchRegistryVersion(packageName);

        if (!registryVersion) {
            packageStates.push({
                packageName,
                repoVersion: packageEntry.version,
                registryVersion: null,
                relation: 'repo-ahead',
            });
            continue;
        }

        const comparison = compareVersions(packageEntry.version, registryVersion);

        if (comparison === 0) {
            packageStates.push({
                packageName,
                repoVersion: packageEntry.version,
                registryVersion,
                relation: 'equal',
            });
            continue;
        }

        if (comparison > 0) {
            packageStates.push({
                packageName,
                repoVersion: packageEntry.version,
                registryVersion,
                relation: 'repo-ahead',
            });
            continue;
        }

        packageStates.push({
            packageName,
            repoVersion: packageEntry.version,
            registryVersion,
            relation: 'registry-ahead',
        });
    }

    const registryAheadPackages = packageStates.filter((state) => state.relation === 'registry-ahead');

    if (registryAheadPackages.length > 0) {
        const details = registryAheadPackages
            .map(
                (state) =>
                    `- ${state.packageName}: repo=${state.repoVersion}, registry=${state.registryVersion ?? 'unpublished'}`
            )
            .join('\n');
        throw new Error(
            `Registry versions are ahead of the committed release state for one or more packages.\n${details}`
        );
    }

    const publishablePackages = packageStates
        .filter((state) => state.relation === 'repo-ahead')
        .map((state) => state.packageName);

    return {
        mode: publishablePackages.length > 0 ? 'publish' : 'noop',
        publishablePackages,
        packageStates,
    };
}

async function loadReleaseConfig(rootDir: string): Promise<ReleaseConfig> {
    const configContent = await readFile(join(rootDir, CHANGESET_CONFIG_PATH), 'utf8');
    return JSON.parse(configContent) as ReleaseConfig;
}

async function loadPackageEntries(directory: string): Promise<Map<string, PackageEntry>> {
    const packageJsonPaths = await findPackageJsonPaths(directory);
    const packageEntries = new Map<string, PackageEntry>();

    for (const packageJsonPath of packageJsonPaths) {
        const packageJsonContent = await readFile(packageJsonPath, 'utf8');
        const packageJson = JSON.parse(packageJsonContent) as PackageEntry;

        if (!packageJson.name || !packageJson.version || packageJson.private === true) {
            continue;
        }

        packageEntries.set(packageJson.name, packageJson);
    }

    return packageEntries;
}

async function findPackageJsonPaths(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const packageJsonPaths: string[] = [];

    for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === 'dist') {
            continue;
        }

        const entryPath = join(directory, entry.name);

        if (entry.isDirectory()) {
            packageJsonPaths.push(...(await findPackageJsonPaths(entryPath)));
            continue;
        }

        if (entry.isFile() && entry.name === 'package.json') {
            packageJsonPaths.push(entryPath);
        }
    }

    return packageJsonPaths.sort();
}

async function fetchRegistryVersion(packageName: string): Promise<string | null> {
    const encodedName = encodeURIComponent(packageName);
    const response = await fetch(`https://registry.npmjs.org/${encodedName}`);

    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        throw new Error(
            `Failed to read npm registry metadata for "${packageName}": ${response.status} ${response.statusText}`
        );
    }

    const body = (await response.json()) as {
        'dist-tags'?: {
            latest?: string;
        };
    };

    return body['dist-tags']?.latest ?? null;
}

function compareVersions(left: string, right: string): number {
    const leftVersion = parseVersion(left);
    const rightVersion = parseVersion(right);

    if (leftVersion.major !== rightVersion.major) {
        return leftVersion.major - rightVersion.major;
    }

    if (leftVersion.minor !== rightVersion.minor) {
        return leftVersion.minor - rightVersion.minor;
    }

    if (leftVersion.patch !== rightVersion.patch) {
        return leftVersion.patch - rightVersion.patch;
    }

    return comparePrerelease(leftVersion.prerelease, rightVersion.prerelease);
}

function parseVersion(version: string): ParsedVersion {
    const [core, prerelease = ''] = version.split('-', 2);

    if (!core) {
        throw new Error(`Unsupported semver value "${version}".`);
    }

    const [major, minor, patch] = core.split('.');

    if (!major || !minor || !patch) {
        throw new Error(`Unsupported semver value "${version}".`);
    }

    return {
        major: parseIntegerPart(major, version),
        minor: parseIntegerPart(minor, version),
        patch: parseIntegerPart(patch, version),
        prerelease: prerelease.length === 0 ? [] : prerelease.split('.'),
    };
}

function parseIntegerPart(value: string, version: string): number {
    if (!/^\d+$/.test(value)) {
        throw new Error(`Unsupported semver value "${version}".`);
    }

    return Number.parseInt(value, 10);
}

function comparePrerelease(left: string[], right: string[]): number {
    if (left.length === 0 && right.length === 0) {
        return 0;
    }

    if (left.length === 0) {
        return 1;
    }

    if (right.length === 0) {
        return -1;
    }

    const length = Math.max(left.length, right.length);

    for (let index = 0; index < length; index += 1) {
        const leftPart = left[index];
        const rightPart = right[index];

        if (leftPart === undefined) {
            return -1;
        }

        if (rightPart === undefined) {
            return 1;
        }

        const comparison = comparePrereleasePart(leftPart, rightPart);

        if (comparison !== 0) {
            return comparison;
        }
    }

    return 0;
}

function comparePrereleasePart(left: string, right: string): number {
    const leftIsNumeric = /^\d+$/.test(left);
    const rightIsNumeric = /^\d+$/.test(right);

    if (leftIsNumeric && rightIsNumeric) {
        return Number.parseInt(left, 10) - Number.parseInt(right, 10);
    }

    if (leftIsNumeric) {
        return -1;
    }

    if (rightIsNumeric) {
        return 1;
    }

    return left.localeCompare(right);
}

async function writeGithubOutput(mode: PublishMode, publishablePackages: string[]): Promise<void> {
    const githubOutput = process.env.GITHUB_OUTPUT;

    if (!githubOutput) {
        return;
    }

    const lines = [`mode=${mode}`, `packages=${publishablePackages.join(',')}`];

    await appendFile(githubOutput, `${lines.join('\n')}\n`);
}

async function main(): Promise<void> {
    const rootDir = process.cwd();
    const publishState = await resolvePublishState(rootDir);

    for (const state of publishState.packageStates) {
        const registryVersion = state.registryVersion ?? 'unpublished';
        console.log(
            `${state.packageName}: repo=${state.repoVersion}, registry=${registryVersion}, relation=${state.relation}`
        );
    }

    console.log(`publish-mode=${publishState.mode}`);
    await writeGithubOutput(publishState.mode, publishState.publishablePackages);
}

const isDirectExecution = process.argv[1] ? import.meta.url === new URL(`file://${process.argv[1]}`).href : false;

if (isDirectExecution) {
    // oxlint-disable-next-line unicorn/prefer-top-level-await
    main().catch((error: unknown) => {
        console.error(error);
        process.exit(1);
    });
}
