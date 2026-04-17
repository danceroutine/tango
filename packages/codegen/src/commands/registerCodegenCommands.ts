import type { Argv } from 'yargs';
import { withNewCommand } from './runNewCommand';
import { withGenerateRelationsCommand } from './runGenerateRelationsCommand';
import { withInitCommand } from './runInitCommand';

/**
 * Register Tango project scaffolding commands on an existing CLI parser.
 */
export function registerCodegenCommands(parser: Argv): Argv {
    const withTopLevelNew = withNewCommand(parser);
    const withTopLevelInit = withInitCommand(withTopLevelNew);
    const withTopLevelRelations = withGenerateRelationsCommand(withTopLevelInit);
    return withTopLevelRelations.command('codegen <command>', 'Code generation command group', (builder) =>
        withGenerateRelationsCommand(withInitCommand(withNewCommand(builder)))
    );
}
