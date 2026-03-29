declare module '@danceroutine/tango-migrations' {
    import type { Argv } from 'yargs';

    export function registerMigrationsCommands(parser: Argv): Argv;
}

declare module '@danceroutine/tango-codegen' {
    import type { Argv } from 'yargs';

    export function registerCodegenCommands(parser: Argv): Argv;
}
