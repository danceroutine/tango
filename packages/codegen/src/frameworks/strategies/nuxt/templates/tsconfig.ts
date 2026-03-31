import { TemplateBuilder } from '../../../contracts/template/TemplateBuilder';
import type { FrameworkScaffoldContext } from '../../../contracts/template/ScaffoldTemplate';

export class TsConfigTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'tsconfig.json' });
    }

    protected override resolveTemplate(_context: FrameworkScaffoldContext): string {
        return JSON.stringify(
            {
                extends: './.nuxt/tsconfig.json',
                compilerOptions: {
                    strict: true,
                },
                include: ['.nuxt/**/*.d.ts', '**/*.ts', '**/*.vue', 'migrations/**/*.ts'],
            },
            null,
            4
        );
    }
}
