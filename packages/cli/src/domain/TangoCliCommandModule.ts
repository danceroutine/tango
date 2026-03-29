import type { Argv } from 'yargs';

/**
 * Contract for modules that attach one command subtree to the shared Tango CLI.
 */
export interface TangoCliCommandModule {
    /**
     * Stable identifier used to describe the module within composed CLI setups.
     */
    readonly id: string;

    /**
     * Register the module's commands on the shared yargs parser.
     */
    register(parser: Argv): Argv;
}
