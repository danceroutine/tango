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
                    dev: 'next dev',
                    prestart: 'tango migrate --config ./tango.config.ts',
                    build: 'next build',
                    start: 'next start',
                    typecheck: 'tsc --noEmit',
                    'setup:schema':
                        "node -e \"require('node:fs').mkdirSync('./.data',{recursive:true})\" && tango migrate --config ./tango.config.ts",
                    'make:migrations':
                        'tango make:migrations --config ./tango.config.ts --models ./src/lib/models/index.ts --name "${npm_config_name:-manual_change}"',
                    prebootstrap:
                        "node -e \"require('node:fs').mkdirSync('./.data',{recursive:true})\" && tango migrate --config ./tango.config.ts",
                    bootstrap: 'tsx scripts/bootstrap.ts',
                },
                dependencies: {
                    ...deps,
                    next: '^15.1.6',
                    react: '^19.0.0',
                    'react-dom': '^19.0.0',
                    zod: '^4.0.0',
                },
                devDependencies: {
                    ...devDeps,
                    '@types/node': '^22.9.0',
                    '@types/react': '^19.0.6',
                    '@types/react-dom': '^19.0.2',
                    tsx: '^4.20.6',
                    typescript: '^5.6.3',
                },
            },
            null,
            4
        );
    }
}
