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
                    predev: 'sh -c \'if [ "$TANGO_SKIP_SETUP_SCHEMA" = "true" ]; then exit 0; fi; pnpm run setup:schema\'',
                    dev: 'NUXT_TELEMETRY_DISABLED=1 nuxt dev',
                    prestart:
                        'sh -c \'if [ "$TANGO_SKIP_SETUP_SCHEMA" = "true" ]; then exit 0; fi; pnpm run setup:schema\'',
                    build: 'NUXT_TELEMETRY_DISABLED=1 nuxt build',
                    start: 'NUXT_TELEMETRY_DISABLED=1 nuxt preview',
                    typecheck: 'NUXT_TELEMETRY_DISABLED=1 nuxt typecheck',
                    'setup:schema': 'pnpm exec tango migrate --config ./tango.config.ts',
                    'make:migrations':
                        'pnpm exec tango make:migrations --config ./tango.config.ts --models ./lib/models/index.ts --name "${npm_config_name:-manual_change}"',
                    'codegen:relations': 'pnpm exec tango codegen relations --models ./lib/models/index.ts',
                    prebootstrap: 'pnpm run setup:schema',
                    bootstrap: 'tsx scripts/bootstrap.ts',
                },
                dependencies: {
                    ...deps,
                    nuxt: '^4.4.2',
                    vue: '^3.5.31',
                    zod: '^4.0.0',
                },
                devDependencies: {
                    ...devDeps,
                    '@types/node': '^22.9.0',
                    tsx: '^4.20.6',
                    typescript: '^5.6.3',
                    'vue-tsc': '^3.1.2',
                },
            },
            null,
            4
        );
    }
}
