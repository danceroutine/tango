import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import type { TangoCliCommandModule } from './domain/TangoCliCommandModule';
import { createDefaultCommandModules } from './commands/createDefaultCommandModules';

export type RunCliOptions = {
    /**
     * Argument vector to parse. When omitted, the current process argv is used.
     */
    argv?: readonly string[];

    /**
     * Command modules to register before parsing. The built-in set is used by default.
     */
    modules?: readonly TangoCliCommandModule[];
};

/**
 * Run Tango's CLI with a supplied argv list and command module set.
 *
 * This is the entry point used by the binary, and it is also useful in tests
 * or host applications that want to customize which commands are available.
 */
export async function runCli(options: RunCliOptions = {}): Promise<void> {
    const modules = options.modules ?? createDefaultCommandModules();
    const argvInput = options.argv ?? hideBin(process.argv);

    let parser = yargs([...argvInput]);
    parser = parser.scriptName('tango');

    for (const module of modules) {
        parser = module.register(parser);
    }

    await parser
        .demandCommand(1, 'You must specify a command')
        .strict()
        .exitProcess(false)
        .help()
        .alias('help', 'h')
        .alias('version', 'v')
        .parseAsync();
}
