#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

const [baseRef, headRef = 'HEAD'] = process.argv.slice(2);

if (!baseRef) {
    throw new Error('Expected base ref SHA as the first argument');
}

const dependencyFields = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const runtimeDependencyFields = new Set(['dependencies', 'peerDependencies', 'optionalDependencies']);
const packageManifestPattern = /(^|\/)package\.json$/;
const allowedNonManifestPatterns = [/^pnpm-lock\.yaml$/, /^\.github\/.+/];
const prAuthor = process.env.PR_AUTHOR ?? '';
const comparisonBaseRef = git(['merge-base', baseRef, headRef]);

function git(args) {
    return execFileSync('git', args, {
        cwd: process.cwd(),
        encoding: 'utf8',
    }).trim();
}

function emitResult({ shouldSkip, reason, classifiedFiles = [] }) {
    console.log(`should_skip=${shouldSkip ? 'true' : 'false'}`);
    console.log('reason<<EOF');
    console.log(reason);
    console.log('EOF');
    console.log('classified_files<<EOF');
    if (classifiedFiles.length > 0) {
        console.log(classifiedFiles.join('\n'));
    }
    console.log('EOF');
}

function isDependabotAuthor(author) {
    return author === 'dependabot[bot]' || author === 'app/dependabot';
}

function readJsonAtRef(ref, path) {
    try {
        const raw = ref === 'HEAD' ? readFileSync(path, 'utf8') : git(['show', `${ref}:${path}`]);
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function classifyManifest(path) {
    const baseManifest = readJsonAtRef(comparisonBaseRef, path);
    const headManifest = readJsonAtRef(headRef, path);

    if (baseManifest === null || headManifest === null) {
        return {
            canSkip: false,
            reason: 'package manifest could not be loaded from both refs',
        };
    }

    const nonDependencyKeys = new Set([...Object.keys(baseManifest), ...Object.keys(headManifest)]);

    for (const field of dependencyFields) {
        nonDependencyKeys.delete(field);
    }

    const changedNonDependencyKeys = [...nonDependencyKeys].filter(
        (key) => !isDeepStrictEqual(baseManifest[key], headManifest[key])
    );

    if (changedNonDependencyKeys.length > 0) {
        return {
            canSkip: false,
            reason: `non-dependency manifest fields changed: ${changedNonDependencyKeys.join(', ')}`,
        };
    }

    const changedDependencyFields = dependencyFields.filter(
        (field) => !isDeepStrictEqual(baseManifest[field] ?? {}, headManifest[field] ?? {})
    );

    if (changedDependencyFields.length === 0) {
        return {
            canSkip: false,
            reason: 'manifest changed without dependency field changes',
        };
    }

    const isPrivatePackage = path === 'package.json' || Boolean(baseManifest.private) || Boolean(headManifest.private);
    if (isPrivatePackage) {
        return {
            canSkip: true,
            reason: 'private/workspace dependency-only change',
        };
    }

    const changedRuntimeField = changedDependencyFields.find((field) => runtimeDependencyFields.has(field));

    if (changedRuntimeField) {
        return {
            canSkip: false,
            reason: `published package changes ${changedRuntimeField}`,
        };
    }

    return {
        canSkip: true,
        reason: 'published package devDependency-only change',
    };
}

if (!isDependabotAuthor(prAuthor)) {
    emitResult({
        shouldSkip: false,
        reason: `PR author ${prAuthor || 'unknown'} is not Dependabot`,
    });
    process.exit(0);
}

const changedFiles = git(['diff', '--name-only', `${comparisonBaseRef}..${headRef}`])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

if (changedFiles.length === 0) {
    emitResult({
        shouldSkip: false,
        reason: 'No changed files detected for the PR diff',
    });
    process.exit(0);
}

const classifiedFiles = [];
const blockingReasons = [];

for (const path of changedFiles) {
    if (packageManifestPattern.test(path)) {
        const classification = classifyManifest(path);
        classifiedFiles.push(`${path}: ${classification.reason}`);

        if (!classification.canSkip) {
            blockingReasons.push(`${path}: ${classification.reason}`);
        }

        continue;
    }

    if (allowedNonManifestPatterns.some((pattern) => pattern.test(path))) {
        classifiedFiles.push(`${path}: whitelisted non-manifest change`);
        continue;
    }

    classifiedFiles.push(`${path}: requires explicit maintainer review`);
    blockingReasons.push(`${path}: non-manifest change outside the allowlist`);
}

if (blockingReasons.length > 0) {
    emitResult({
        shouldSkip: false,
        reason: `Dependabot PR still requires an explicit changeset check: ${blockingReasons.join('; ')}`,
        classifiedFiles,
    });
    process.exit(0);
}

emitResult({
    shouldSkip: true,
    reason: 'Dependabot PR only changes workflow files, lockfile entries, or skip-eligible dependency fields.',
    classifiedFiles,
});
