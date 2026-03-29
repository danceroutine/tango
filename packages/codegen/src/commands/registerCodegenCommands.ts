import type { Argv } from 'yargs';
import { withNewCommand } from './runNewCommand';
import { withInitCommand } from './runInitCommand';

/**
 * Register Tango project scaffolding commands on an existing CLI parser.
 */
export function registerCodegenCommands(parser: Argv): Argv {
    const withTopLevelNew = withNewCommand(parser);
    const withTopLevelInit = withInitCommand(withTopLevelNew);
    return withTopLevelInit.command('codegen <command>', 'Code generation command group', (builder) =>
        withInitCommand(withNewCommand(builder))
    );
}
