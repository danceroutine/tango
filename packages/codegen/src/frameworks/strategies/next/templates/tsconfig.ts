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
                    lib: ['dom', 'dom.iterable', 'es2022'],
                    strict: true,
                    noEmit: true,
                    module: 'esnext',
                    moduleResolution: 'bundler',
                    resolveJsonModule: true,
                    isolatedModules: true,
                    jsx: 'preserve',
                    esModuleInterop: true,
                    baseUrl: '.',
                    paths: {
                        '@/*': ['src/*'],
                    },
                },
                include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', 'migrations/**/*.ts'],
                exclude: ['node_modules'],
            },
            null,
            4
        );
    }
}
