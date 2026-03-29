import { TemplateBuilder } from '../../../contracts/template/TemplateBuilder';
import type { FrameworkScaffoldContext } from '../../../contracts/template/ScaffoldTemplate';

export class TsConfigBuildTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'tsconfig.build.json' });
    }

    protected override resolveTemplate(_context: FrameworkScaffoldContext): string {
        return JSON.stringify(
            {
                extends: './tsconfig.json',
                compilerOptions: {
                    noEmit: false,
                    outDir: './dist',
                    rootDir: '.',
                    sourceMap: true,
                    declaration: false,
                },
                include: ['src', 'tango.config.ts'],
                exclude: ['node_modules', 'dist', 'migrations', '**/*.test.ts'],
            },
            null,
            4
        );
    }
}
