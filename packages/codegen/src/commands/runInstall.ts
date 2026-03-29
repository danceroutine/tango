import { spawnSync } from 'child_process';
import type { PackageManager } from '../frameworks';

export function runInstall(packageManager: PackageManager, cwd: string): void {
    const argsByPackageManager: Record<PackageManager, readonly string[]> = {
        pnpm: ['install'],
        npm: ['install'],
        yarn: ['install'],
        bun: ['install'],
    };

    const result = spawnSync(packageManager, [...argsByPackageManager[packageManager]], {
        cwd,
        stdio: 'inherit',
        env: process.env,
    });

    if (result.status !== 0) {
        throw new Error(
            `Dependency install failed with ${packageManager}. Exit code: ${String(result.status ?? 'unknown')}.`
        );
    }
}
