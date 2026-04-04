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

type ResolutionMode = 'publish' | 'stable-input';
type WorkflowMode = 'noop' | 'publish' | 'ready';

type PackageRelation = 'already-published' | 'publish-missing' | 'registry-ahead' | 'unpublished-package';

type PackagePublishState = {
    packageName: string;
    repoVersion: string;
    highestPublishedStableVersion: string | null;
    relation: PackageRelation;
};

type RegistryPackageMetadata = {
    highestPublishedStableVersion: string | null;
    publishedVersions: Set<string>;
};

type ResolveStateOptions = {
    readRegistryMetadata?: (packageName: string) => Promise<RegistryPackageMetadata>;
};

type ResolvePublishStateResult = {
    mode: Extract<WorkflowMode, 'noop' | 'publish'>;
    publishablePackages: string[];
    packageStates: PackagePublishState[];
};

type ResolveStableInputStateResult = {
    mode: Extract<WorkflowMode, 'ready'>;
    packageStates: PackagePublishState[];
};

type ParsedVersion = {
    major: number;
    minor: number;
    patch: number;
    prerelease: string[];
};

const CHANGESET_CONFIG_PATH = '.changeset/config.json';
const PACKAGES_DIRECTORY = 'packages';

export async function resolvePublishState(
    rootDir: string,
    options: ResolveStateOptions = {}
): Promise<ResolvePublishStateResult> {
    const packageStates = await collectPackageStates(rootDir, options);
    assertNoRegistryAheadPackages(packageStates);

    const publishablePackages = packageStates
        .filter((state) => state.relation === 'publish-missing' || state.relation === 'unpublished-package')
        .map((state) => state.packageName);

    return {
        mode: publishablePackages.length > 0 ? 'publish' : 'noop',
        publishablePackages,
        packageStates,
    };
}

export async function resolveStableInputState(
    rootDir: string,
    options: ResolveStateOptions = {}
): Promise<ResolveStableInputStateResult> {
    const packageStates = await collectPackageStates(rootDir, options);
    assertNoRegistryAheadPackages(packageStates);

    const repoAheadPackages = packageStates.filter((state) => state.relation === 'publish-missing');

    if (repoAheadPackages.length > 0) {
        const details = formatPackageStateDetails(repoAheadPackages);
        throw new Error(
            [
                'The committed stable release state is ahead of npm for one or more existing packages.',
                'Run stable-recovery before attempting a new stable version bump.',
                details,
            ].join('\n')
        );
    }

    return {
        mode: 'ready',
        packageStates,
    };
}

async function collectPackageStates(rootDir: string, options: ResolveStateOptions): Promise<PackagePublishState[]> {
    const releaseConfig = await loadReleaseConfig(rootDir);
    const fixedPackages = releaseConfig.fixed?.[0];

    if (!fixedPackages || fixedPackages.length === 0) {
        throw new Error('Expected .changeset/config.json to declare a fixed release group.');
    }

    const ignoredPackages = new Set(releaseConfig.ignore ?? []);
    const releasablePackages = fixedPackages.filter((packageName) => !ignoredPackages.has(packageName));
    const packageEntries = await loadPackageEntries(join(rootDir, PACKAGES_DIRECTORY));
    const packageStates: PackagePublishState[] = [];
    const readRegistryMetadata = options.readRegistryMetadata ?? fetchRegistryMetadata;

    for (const packageName of releasablePackages) {
        const packageEntry = packageEntries.get(packageName);

        if (!packageEntry) {
            throw new Error(`Could not find package.json for release package "${packageName}".`);
        }

        const registryMetadata = await readRegistryMetadata(packageName);
        packageStates.push(classifyPackageState(packageEntry, registryMetadata));
    }

    return packageStates;
}

function classifyPackageState(
    packageEntry: PackageEntry,
    registryMetadata: RegistryPackageMetadata
): PackagePublishState {
    if (!registryMetadata.highestPublishedStableVersion) {
        return {
            packageName: packageEntry.name,
            repoVersion: packageEntry.version,
            highestPublishedStableVersion: null,
            relation: 'unpublished-package',
        };
    }

    const comparison = compareVersions(packageEntry.version, registryMetadata.highestPublishedStableVersion);

    if (comparison < 0) {
        return {
            packageName: packageEntry.name,
            repoVersion: packageEntry.version,
            highestPublishedStableVersion: registryMetadata.highestPublishedStableVersion,
            relation: 'registry-ahead',
        };
    }

    if (registryMetadata.publishedVersions.has(packageEntry.version)) {
        return {
            packageName: packageEntry.name,
            repoVersion: packageEntry.version,
            highestPublishedStableVersion: registryMetadata.highestPublishedStableVersion,
            relation: 'already-published',
        };
    }

    return {
        packageName: packageEntry.name,
        repoVersion: packageEntry.version,
        highestPublishedStableVersion: registryMetadata.highestPublishedStableVersion,
        relation: 'publish-missing',
    };
}

function assertNoRegistryAheadPackages(packageStates: PackagePublishState[]): void {
    const registryAheadPackages = packageStates.filter((state) => state.relation === 'registry-ahead');

    if (registryAheadPackages.length === 0) {
        return;
    }

    const details = formatPackageStateDetails(registryAheadPackages);
    throw new Error(`Registry versions are ahead of the committed release state for one or more packages.\n${details}`);
}

function formatPackageStateDetails(packageStates: PackagePublishState[]): string {
    return packageStates
        .map(
            (state) =>
                `- ${state.packageName}: repo=${state.repoVersion}, registry=${state.highestPublishedStableVersion ?? 'unpublished'}`
        )
        .join('\n');
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

async function fetchRegistryMetadata(packageName: string): Promise<RegistryPackageMetadata> {
    const encodedName = encodeURIComponent(packageName);
    const response = await fetch(`https://registry.npmjs.org/${encodedName}`);

    if (response.status === 404) {
        return {
            highestPublishedStableVersion: null,
            publishedVersions: new Set(),
        };
    }

    if (!response.ok) {
        throw new Error(
            `Failed to read npm registry metadata for "${packageName}": ${response.status} ${response.statusText}`
        );
    }

    const body = (await response.json()) as {
        versions?: Record<string, unknown>;
    };
    const publishedVersions = new Set(Object.keys(body.versions ?? {}));

    return {
        highestPublishedStableVersion: findHighestPublishedStableVersion(publishedVersions),
        publishedVersions,
    };
}

function findHighestPublishedStableVersion(publishedVersions: Set<string>): string | null {
    let highestVersion: string | null = null;

    for (const version of publishedVersions) {
        if (parseVersion(version).prerelease.length > 0) {
            continue;
        }

        if (!highestVersion || compareVersions(version, highestVersion) > 0) {
            highestVersion = version;
        }
    }

    return highestVersion;
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

async function writeGithubOutput(
    mode: WorkflowMode,
    packageStates: PackagePublishState[],
    publishablePackages: string[]
): Promise<void> {
    const githubOutput = process.env.GITHUB_OUTPUT;

    if (!githubOutput) {
        return;
    }

    const counts = {
        alreadyPublished: packageStates.filter((state) => state.relation === 'already-published').length,
        publishMissing: packageStates.filter((state) => state.relation === 'publish-missing').length,
        unpublishedPackages: packageStates.filter((state) => state.relation === 'unpublished-package').length,
        registryAhead: packageStates.filter((state) => state.relation === 'registry-ahead').length,
    };
    const lines = [
        `mode=${mode}`,
        `packages=${publishablePackages.join(',')}`,
        `already_published=${counts.alreadyPublished}`,
        `publish_missing=${counts.publishMissing}`,
        `unpublished_packages=${counts.unpublishedPackages}`,
        `registry_ahead=${counts.registryAhead}`,
    ];

    await appendFile(githubOutput, `${lines.join('\n')}\n`);
}

function parseExecutionMode(argv: string[]): ResolutionMode {
    const modeArgument = argv.find((argument) => argument.startsWith('--mode='));
    const mode = modeArgument?.slice('--mode='.length) ?? 'publish';

    if (mode !== 'publish' && mode !== 'stable-input') {
        throw new Error(`Unsupported resolver mode "${mode}".`);
    }

    return mode;
}

async function main(): Promise<void> {
    const rootDir = process.cwd();
    const mode = parseExecutionMode(process.argv.slice(2));

    if (mode === 'stable-input') {
        const resolution = await resolveStableInputState(rootDir);

        for (const state of resolution.packageStates) {
            const registryVersion = state.highestPublishedStableVersion ?? 'unpublished';
            console.log(
                `${state.packageName}: repo=${state.repoVersion}, registry=${registryVersion}, relation=${state.relation}`
            );
        }

        console.log(
            [
                `resolution-mode=${mode}`,
                `workflow-mode=${resolution.mode}`,
                `already-published=${resolution.packageStates.filter((state) => state.relation === 'already-published').length}`,
                `publish-missing=${resolution.packageStates.filter((state) => state.relation === 'publish-missing').length}`,
                `unpublished-packages=${resolution.packageStates.filter((state) => state.relation === 'unpublished-package').length}`,
                `registry-ahead=${resolution.packageStates.filter((state) => state.relation === 'registry-ahead').length}`,
            ].join('\n')
        );
        await writeGithubOutput(resolution.mode, resolution.packageStates, []);
        return;
    }

    const resolution = await resolvePublishState(rootDir);

    for (const state of resolution.packageStates) {
        const registryVersion = state.highestPublishedStableVersion ?? 'unpublished';
        console.log(
            `${state.packageName}: repo=${state.repoVersion}, registry=${registryVersion}, relation=${state.relation}`
        );
    }

    console.log(
        [
            `resolution-mode=${mode}`,
            `workflow-mode=${resolution.mode}`,
            `already-published=${resolution.packageStates.filter((state) => state.relation === 'already-published').length}`,
            `publish-missing=${resolution.packageStates.filter((state) => state.relation === 'publish-missing').length}`,
            `unpublished-packages=${resolution.packageStates.filter((state) => state.relation === 'unpublished-package').length}`,
            `registry-ahead=${resolution.packageStates.filter((state) => state.relation === 'registry-ahead').length}`,
        ].join('\n')
    );
    await writeGithubOutput(resolution.mode, resolution.packageStates, resolution.publishablePackages);
}

const isDirectExecution = process.argv[1] ? import.meta.url === new URL(`file://${process.argv[1]}`).href : false;

if (isDirectExecution) {
    // oxlint-disable-next-line unicorn/prefer-top-level-await
    main().catch((error: unknown) => {
        console.error(error);
        process.exit(1);
    });
}
