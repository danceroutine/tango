import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import type { FrameworkScaffoldStrategy } from '../contracts/FrameworkScaffoldStrategy';
import type { FrameworkScaffoldContext, ScaffoldMode } from '../contracts/template/ScaffoldTemplate';

export type ScaffoldProjectOptions = {
    force?: boolean;
    /** 'new' = full scaffold; 'init' = only Tango + init-only files. Default 'new'. */
    mode?: ScaffoldMode;
    /** When true, do not overwrite existing files. Default true when mode === 'init', otherwise false. */
    skipExisting?: boolean;
};

function resolveTargetDir(targetDir: string): string {
    if (isAbsolute(targetDir)) {
        return targetDir;
    }
    return resolve(process.cwd(), targetDir);
}

async function ensureWritableTargetDir(
    targetDir: string,
    options: ScaffoldProjectOptions & { mode: ScaffoldMode }
): Promise<void> {
    const absoluteTargetDir = resolveTargetDir(targetDir);

    try {
        const targetStats = await stat(absoluteTargetDir);
        if (!targetStats.isDirectory()) {
            throw new Error(`Target path '${absoluteTargetDir}' exists and is not a directory.`);
        }

        if (options.mode === 'new') {
            const contents = await readdir(absoluteTargetDir);
            if (contents.length > 0 && !options.force) {
                throw new Error(
                    `Target directory '${absoluteTargetDir}' is not empty. Pass --force to allow scaffolding into a non-empty directory.`
                );
            }
        }
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            await mkdir(absoluteTargetDir, { recursive: true });
            return;
        }
        throw error;
    }
}

/**
 * Write a framework scaffold into a target directory after basic safety checks.
 *
 * The selected strategy controls which files are created, while this helper
 * owns directory validation and filesystem writes. With mode 'init', only
 * Tango and init-only templates are emitted, and existing files can be skipped.
 */
export async function scaffoldProject(
    context: FrameworkScaffoldContext,
    strategy: FrameworkScaffoldStrategy,
    options: ScaffoldProjectOptions = {}
): Promise<void> {
    const mode = options.mode ?? 'new';
    const skipExisting = options.skipExisting ?? mode === 'init';
    const resolvedOptions = { ...options, mode, skipExisting };

    await ensureWritableTargetDir(context.targetDir, resolvedOptions);

    const allTemplates = strategy.getTemplates();
    const templates = allTemplates.filter((t) => t.shouldEmit(mode));

    for (const template of templates) {
        const absolutePath = resolveTargetDir(resolve(context.targetDir, template.path));
        if (skipExisting && !options.force) {
            try {
                await stat(absolutePath);
                continue;
            } catch {
                // ENOENT or other: proceed to write
            }
        }
        await mkdir(dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, template.render(context), 'utf8');
    }
}
