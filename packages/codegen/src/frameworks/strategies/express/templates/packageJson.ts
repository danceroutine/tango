import { TemplateBuilder } from '../../../contracts/template/TemplateBuilder';
import type { FrameworkScaffoldContext } from '../../../contracts/template/ScaffoldTemplate';

export class PackageJsonTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'package.json' });
    }

    protected override resolveTemplate(context: FrameworkScaffoldContext): string {
        const deps = this.getTangoDependencyEntries(context);
        const devDeps = this.getTangoDevDependencyEntries(context);

        return JSON.stringify(
            {
                name: context.projectName,
                private: true,
                type: 'module',
                scripts: {
                    predev: 'tango migrate --config ./tango.config.ts',
                    dev: 'tsx watch src/index.ts',
                    prestart: 'tango migrate --config ./tango.config.ts',
                    build: 'tsc -p tsconfig.build.json',
                    start: 'node dist/index.js',
                    typecheck: 'tsc --noEmit',
                    'setup:schema':
                        "node -e \"require('node:fs').mkdirSync('./.data',{recursive:true})\" && tango migrate --config ./tango.config.ts",
                    'make:migrations':
                        'tango make:migrations --config ./tango.config.ts --models ./src/models/index.ts --name "${npm_config_name:-manual_change}"',
                    prebootstrap:
                        "node -e \"require('node:fs').mkdirSync('./.data',{recursive:true})\" && tango migrate --config ./tango.config.ts",
                    bootstrap: 'tsx src/bootstrap.ts',
                },
                dependencies: {
                    ...deps,
                    express: '^4.21.2',
                    zod: '^4.0.0',
                },
                devDependencies: {
                    ...devDeps,
                    '@types/express': '^5.0.0',
                    '@types/node': '^22.9.0',
                    tsx: '^4.20.6',
                    typescript: '^5.6.3',
                },
            },
            null,
            4
        );
    }
}
