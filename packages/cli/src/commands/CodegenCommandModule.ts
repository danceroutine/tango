import type { Argv } from 'yargs';
import { registerCodegenCommands } from '@danceroutine/tango-codegen';
import type { TangoCliCommandModule } from '../domain/TangoCliCommandModule';

/**
 * CLI module that mounts Tango's code-generation commands.
 */
export class CodegenCommandModule implements TangoCliCommandModule {
    readonly id = 'codegen';

    /**
     * Register the code-generation command tree on the shared parser.
     */
    register(parser: Argv): Argv {
        return registerCodegenCommands(parser);
    }
}
