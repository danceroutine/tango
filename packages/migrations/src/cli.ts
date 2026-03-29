#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { registerMigrationsCommands } from './commands/cli';

function runMigrationsCli(): void {
    registerMigrationsCommands(yargs(hideBin(process.argv)))
        .scriptName('tango')
        .demandCommand(1, 'You must specify a command')
        .strict()
        .help()
        .alias('help', 'h')
        .alias('version', 'v')
        .parse();
}

runMigrationsCli();
