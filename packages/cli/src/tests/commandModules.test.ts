import yargs from 'yargs';
import { describe, expect, it, vi } from 'vitest';
import { CodegenCommandModule } from '../commands/CodegenCommandModule';
import { MigrationsCommandModule } from '../commands/MigrationsCommandModule';

vi.mock('@danceroutine/tango-codegen', () => ({
    registerCodegenCommands: vi.fn((parser) =>
        parser.command(
            'new',
            'noop',
            () => {},
            async () => {}
        )
    ),
}));

vi.mock('@danceroutine/tango-migrations', () => ({
    registerMigrationsCommands: vi.fn((parser) =>
        parser.command(
            'migrate',
            'noop',
            () => {},
            async () => {}
        )
    ),
}));

describe('command modules', () => {
    it('includes the codegen command module', () => {
        const module = new CodegenCommandModule();
        const parser = yargs([]);

        const registered = module.register(parser);

        expect(registered).toBe(parser);
    });

    it('includes the migrations command module', () => {
        const module = new MigrationsCommandModule();
        const parser = yargs([]);

        const registered = module.register(parser);

        expect(registered).toBe(parser);
    });
});
