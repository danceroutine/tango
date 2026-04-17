import { spawnSync } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

type BumpType = 'major' | 'minor' | 'patch';

interface ChangesetReleaseNote {
    filename: string;
    packages: string[];
    summary: string;
    bumpTypes: Record<string, BumpType>;
}

interface ReleaseEntry {
    version: string;
    date: string;
    notes: ChangesetReleaseNote[];
}

interface RunCommandOptions {
    cwd: string;
}

type RunCommand = (command: string, args: string[], options: RunCommandOptions) => void | Promise<void>;

const CHANGELOG_INTRO = `# Changelog

This file is generated from stable release changesets during Tango stable releases. Do not edit manually.`;
const NO_RELEASES_MESSAGE = 'No stable releases have been published yet.';
const CHANGESET_DIRECTORY = '.changeset';
const CHANGESET_CONFIG_PATH = join(CHANGESET_DIRECTORY, 'config.json');
const CHANGELOG_PATH = 'CHANGELOG.md';
const CHANGESET_README = 'README.md';

export async function collectPendingChangesets(rootDir: string): Promise<ChangesetReleaseNote[]> {
    const changesetDir = join(rootDir, CHANGESET_DIRECTORY);
    const files = await readdir(changesetDir);
    const releaseNotes = await Promise.all(
        files
            .filter((filename) => filename.endsWith('.md') && filename !== CHANGESET_README)
            .sort()
            .map(async (filename) => parseChangesetFile(join(changesetDir, filename), filename))
    );

    return releaseNotes.filter((note) => note.packages.length > 0);
}

export async function parseChangesetFile(filePath: string, filename = filePath): Promise<ChangesetReleaseNote> {
    const fileContent = await readFile(filePath, 'utf8');
    return parseChangesetContent(fileContent, filename);
}

export function parseChangesetContent(content: string, filename: string): ChangesetReleaseNote {
    const normalizedContent = normalizeLineEndings(content).trim();

    if (!normalizedContent.startsWith('---\n')) {
        throw new Error(`Invalid changeset file "${filename}": missing frontmatter opening delimiter.`);
    }

    const closingDelimiterIndex = normalizedContent.indexOf('\n---\n', 4);

    if (closingDelimiterIndex === -1) {
        throw new Error(`Invalid changeset file "${filename}": missing frontmatter closing delimiter.`);
    }

    const frontmatter = normalizedContent.slice(4, closingDelimiterIndex).trim();
    const summary = normalizedContent.slice(closingDelimiterIndex + 5).trim();

    if (summary.length === 0) {
        throw new Error(`Invalid changeset file "${filename}": missing summary text.`);
    }

    const bumpTypes: Record<string, BumpType> = {};

    for (const line of frontmatter.split('\n')) {
        const trimmedLine = line.trim();

        if (trimmedLine.length === 0) {
            continue;
        }

        const match = /^["']?([^"']+)["']?:\s*(major|minor|patch)\s*$/.exec(trimmedLine);

        if (!match) {
            throw new Error(`Invalid changeset file "${filename}": unsupported frontmatter line "${trimmedLine}".`);
        }

        const packageName = match[1];
        const bumpType = match[2];

        if (!packageName || !bumpType) {
            throw new Error(`Invalid changeset file "${filename}": unsupported frontmatter line "${trimmedLine}".`);
        }

        bumpTypes[packageName] = bumpType as BumpType;
    }

    return {
        filename,
        packages: Object.keys(bumpTypes),
        summary,
        bumpTypes,
    };
}

export async function loadFixedReleasePackages(rootDir: string): Promise<string[]> {
    const configContent = await readFile(join(rootDir, CHANGESET_CONFIG_PATH), 'utf8');
    const config = JSON.parse(configContent) as { fixed?: string[][] };
    const fixedGroup = config.fixed?.[0];

    if (!fixedGroup || fixedGroup.length === 0) {
        throw new Error('Expected .changeset/config.json to declare a fixed release group.');
    }

    return fixedGroup;
}

export async function readReleaseVersion(rootDir: string, packageNames: string[]): Promise<string> {
    const packageEntries = await loadPublishedPackageEntries(rootDir);
    const versions = new Set<string>();

    for (const packageName of packageNames) {
        const packageEntry = packageEntries.get(packageName);

        if (!packageEntry) {
            throw new Error(`Could not find package.json for release package "${packageName}".`);
        }

        versions.add(packageEntry.version);
    }

    if (versions.size !== 1) {
        throw new Error(
            `Expected fixed release packages to share one version, found: ${Array.from(versions).join(', ')}`
        );
    }

    const version = Array.from(versions)[0];

    if (!version) {
        throw new Error('Expected at least one version after reading the fixed release packages.');
    }

    return version;
}

export function prependReleaseEntry(
    existingContent: string,
    releaseEntry: ReleaseEntry,
    _packageOrder: string[]
): string {
    const formattedEntry = formatReleaseEntry(releaseEntry);
    const normalizedExistingContent = normalizeLineEndings(existingContent).trim();

    if (
        normalizedExistingContent.length === 0 ||
        normalizedExistingContent === `${CHANGELOG_INTRO}\n\n${NO_RELEASES_MESSAGE}`
    ) {
        return `${CHANGELOG_INTRO}\n\n${formattedEntry}\n`;
    }

    if (!normalizedExistingContent.startsWith(CHANGELOG_INTRO)) {
        return `${CHANGELOG_INTRO}\n\n${formattedEntry}\n`;
    }

    const existingEntries = normalizedExistingContent.slice(CHANGELOG_INTRO.length).trim();

    if (existingEntries.length === 0 || existingEntries === NO_RELEASES_MESSAGE) {
        return `${CHANGELOG_INTRO}\n\n${formattedEntry}\n`;
    }

    return `${CHANGELOG_INTRO}\n\n${formattedEntry}\n\n${existingEntries}\n`;
}

export async function runReleaseVersioning(
    options: {
        rootDir?: string;
        date?: string;
        runCommand?: RunCommand;
    } = {}
): Promise<void> {
    const rootDir = options.rootDir ?? process.cwd();
    const runCommand = options.runCommand ?? runShellCommand;
    const date = options.date ?? new Date().toISOString().slice(0, 10);
    const pendingChangesets = await collectPendingChangesets(rootDir);

    await runCommand('pnpm', ['changeset', 'version'], { cwd: rootDir });
    await runCommand('pnpm', ['install', '--lockfile-only'], { cwd: rootDir });

    if (pendingChangesets.length === 0) {
        return;
    }

    const packageOrder = await loadFixedReleasePackages(rootDir);
    const releaseVersion = await readReleaseVersion(rootDir, packageOrder);
    const changelogPath = join(rootDir, CHANGELOG_PATH);
    const existingChangelog = await readFile(changelogPath, 'utf8').catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') {
            return `${CHANGELOG_INTRO}\n\n${NO_RELEASES_MESSAGE}\n`;
        }

        throw error;
    });
    const nextChangelog = prependReleaseEntry(
        existingChangelog,
        {
            version: releaseVersion,
            date,
            notes: pendingChangesets,
        },
        packageOrder
    );

    await writeFile(changelogPath, nextChangelog);
}

async function loadPublishedPackageEntries(rootDir: string): Promise<Map<string, { version: string }>> {
    const packageJsonPaths = await findPackageJsonPaths(join(rootDir, 'packages'));
    const packageEntries = new Map<string, { version: string }>();

    for (const packageJsonPath of packageJsonPaths) {
        const packageJsonContent = await readFile(packageJsonPath, 'utf8');
        const packageJson = JSON.parse(packageJsonContent) as { name?: string; version?: string; private?: boolean };

        if (!packageJson.name || !packageJson.version || packageJson.private === true) {
            continue;
        }

        packageEntries.set(packageJson.name, { version: packageJson.version });
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

function formatReleaseEntry(releaseEntry: ReleaseEntry): string {
    const lines = [`## ${releaseEntry.version} - ${releaseEntry.date}`, ''];

    releaseEntry.notes.forEach((note, index) => {
        lines.push(note.summary.trim());

        if (index < releaseEntry.notes.length - 1) {
            lines.push('');
        }
    });

    return lines.join('\n');
}

function normalizeLineEndings(value: string): string {
    return value.replace(/\r\n/g, '\n');
}

function runShellCommand(command: string, args: string[], options: RunCommandOptions): void {
    const result = spawnSync(command, args, {
        cwd: options.cwd,
        stdio: 'inherit',
        env: process.env,
    });

    if (result.status !== 0) {
        throw new Error(`Command failed: ${command} ${args.join(' ')}`);
    }
}

const isDirectExecution = process.argv[1] ? import.meta.url === new URL(`file://${process.argv[1]}`).href : false;

if (isDirectExecution) {
    // oxlint-disable-next-line unicorn/prefer-top-level-await
    runReleaseVersioning().catch((error: unknown) => {
        console.error(error);
        process.exit(1);
    });
}
