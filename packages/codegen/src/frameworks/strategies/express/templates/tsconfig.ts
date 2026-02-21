import { TemplateBuilder } from '../../../contracts/template/TemplateBuilder';
import type { FrameworkScaffoldContext } from '../../../contracts/template/ScaffoldTemplate';

export class TsConfigTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'tsconfig.json' });
    }

    protected override resolveTemplate(_context: FrameworkScaffoldContext): string {
        return JSON.stringify(
            {
                compilerOptions: {
                    target: 'ES2022',
                    lib: ['ES2022', 'DOM'],
                    module: 'NodeNext',
                    moduleResolution: 'NodeNext',
                    strict: true,
                    noEmit: true,
                    esModuleInterop: true,
                    skipLibCheck: true,
                    resolveJsonModule: true,
                    types: ['node'],
                },
                include: ['src', 'migrations/**/*.ts', 'tango.config.ts'],
                exclude: ['node_modules', 'dist'],
            },
            null,
            4
        );
    }
}
