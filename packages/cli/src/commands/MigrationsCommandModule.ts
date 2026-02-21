import type { Argv } from 'yargs';
import { registerMigrationsCommands } from '@danceroutine/tango-migrations';
import type { TangoCliCommandModule } from '../domain/TangoCliCommandModule';

/**
 * CLI module that mounts Tango's migration commands.
 */
export class MigrationsCommandModule implements TangoCliCommandModule {
    readonly id = 'migrations';

    /**
     * Register the migration command tree on the shared parser.
     */
    register(parser: Argv): Argv {
        return registerMigrationsCommands(parser);
    }
}
