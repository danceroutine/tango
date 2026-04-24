import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

const LEFTOVER_PATTERNS = [/^\.tmp-tango-/, /^\.tango-migrations-cli-/];

async function sweepLeftoverTempDirs(root: string): Promise<void> {
    let entries: string[];
    try {
        entries = await readdir(root);
    } catch {
        return;
    }
    await Promise.all(
        entries.map(async (entry) => {
            if (!LEFTOVER_PATTERNS.some((pattern) => pattern.test(entry))) {
                return;
            }
            const path = join(root, entry);
            try {
                const info = await stat(path);
                if (!info.isDirectory()) {
                    return;
                }
            } catch {
                return;
            }
            await rm(path, { recursive: true, force: true });
        })
    );
}

export async function setup(): Promise<void> {
    await sweepLeftoverTempDirs(process.cwd());
}

export async function teardown(): Promise<void> {
    await sweepLeftoverTempDirs(process.cwd());
}
