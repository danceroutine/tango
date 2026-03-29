import { describe, expect, it, vi } from 'vitest';
import type { Argv } from 'yargs';
import { runCli } from '../runCli';
import type { TangoCliCommandModule } from '../domain/TangoCliCommandModule';

class StubModule implements TangoCliCommandModule {
    readonly id: string;

    constructor(
        id: string,
        private readonly registerFn: (parser: Argv) => Argv
    ) {
        this.id = id;
    }

    register(parser: Argv): Argv {
        return this.registerFn(parser);
    }
}

describe(runCli, () => {
    it('runs the matching command handler', async () => {
        const handler = vi.fn();
        const module = new StubModule('test', (parser) =>
            parser.command(
                'ping',
                'test command',
                () => {},
                async () => {
                    handler();
                }
            )
        );

        await runCli({ argv: ['ping'], modules: [module] });

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('throws when no command is provided', async () => {
        const module = new StubModule('noop', (parser) => parser);

        await expect(runCli({ argv: [], modules: [module] })).rejects.toThrow('You must specify a command');
    });

    it('accepts the built-in command modules by default', async () => {
        await runCli({ argv: ['--help'] });
    });

    it('reads arguments from process.argv when none are provided', async () => {
        const originalArgv = process.argv;
        const handler = vi.fn();
        const module = new StubModule('default-argv', (parser) =>
            parser.command(
                'ping-default',
                'test command',
                () => {},
                async () => {
                    handler();
                }
            )
        );

        process.argv = ['node', 'tango', 'ping-default'];
        try {
            await runCli({ modules: [module] });
            expect(handler).toHaveBeenCalledTimes(1);
        } finally {
            process.argv = originalArgv;
        }
    });
});
