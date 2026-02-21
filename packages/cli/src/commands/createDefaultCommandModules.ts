import type { TangoCliCommandModule } from '../domain/TangoCliCommandModule';
import { CodegenCommandModule } from './CodegenCommandModule';
import { MigrationsCommandModule } from './MigrationsCommandModule';

/**
 * Create the standard command modules shipped with Tango's CLI.
 */
export function createDefaultCommandModules(): readonly TangoCliCommandModule[] {
    return [new MigrationsCommandModule(), new CodegenCommandModule()];
}
