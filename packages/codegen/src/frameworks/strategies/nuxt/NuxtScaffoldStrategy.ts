import { FrameworkScaffoldStrategy } from '../../contracts/FrameworkScaffoldStrategy';
import { TemplateBuilder } from '../../contracts/template/TemplateBuilder';
import type { ScaffoldTemplate } from '../../contracts/template/ScaffoldTemplate';
import { PackageJsonTemplateBuilder } from './templates/packageJson';
import { TsConfigTemplateBuilder } from './templates/tsconfig';
import { NuxtConfigTemplateBuilder } from './templates/nuxtConfig';
import { TodoModelTemplateBuilder, ModelsBarrelTemplateBuilder } from './templates/models';
import { TodoSerializerTemplateBuilder, SerializersBarrelTemplateBuilder } from './templates/serializers';
import { OpenAPITemplateBuilder } from './templates/openapi';
import { ViewSetTemplateBuilder } from './templates/viewSet';
import { PageTemplateBuilder } from './templates/page';
import { AppShellTemplateBuilder } from './templates/layout';
import { HealthRouteTemplateBuilder } from './templates/healthRoute';
import { TodoRouteTemplateBuilder } from './templates/todoRoute';
import { OpenAPIRouteTemplateBuilder } from './templates/openapiRoute';
import { BootstrapTemplateBuilder } from './templates/bootstrap';
import { TangoConfigTemplateBuilder } from './templates/tangoConfig';
import { ReadmeTemplateBuilder } from './templates/readme';

/**
 * Scaffold strategy for creating a Nuxt-hosted Tango project.
 */
export class NuxtScaffoldStrategy extends FrameworkScaffoldStrategy {
    readonly id = 'nuxt' as const;

    readonly name = 'Nuxt';

    readonly description = 'Bootstrap a Tango application hosted by Nuxt Nitro and SSR pages.';

    /**
     * Return the file templates needed for the generated Nuxt project.
     */
    getTemplates(): readonly ScaffoldTemplate[] {
        return [
            this.addFrameworkTemplate(new PackageJsonTemplateBuilder()),
            this.addFrameworkTemplate(new NuxtConfigTemplateBuilder()),
            this.addFrameworkTemplate(new TsConfigTemplateBuilder()),
            this.addFrameworkTemplate(new AppShellTemplateBuilder()),
            this.addFrameworkTemplate(new PageTemplateBuilder()),
            this.addTangoTemplate(new TangoConfigTemplateBuilder()),
            this.addTangoTemplate(new TodoModelTemplateBuilder()),
            this.addTangoTemplate(new ModelsBarrelTemplateBuilder()),
            this.addTangoTemplate(new TodoSerializerTemplateBuilder()),
            this.addTangoTemplate(new SerializersBarrelTemplateBuilder()),
            this.addTangoTemplate(new OpenAPITemplateBuilder()),
            this.addTangoTemplate(new ViewSetTemplateBuilder()),
            this.addTangoTemplate(new HealthRouteTemplateBuilder()),
            this.addTangoTemplate(new OpenAPIRouteTemplateBuilder()),
            this.addTangoTemplate(new TodoRouteTemplateBuilder()),
            this.addTangoTemplate(new BootstrapTemplateBuilder()),
            this.addFrameworkTemplate(TemplateBuilder.createStaticTemplate('migrations/.gitkeep', '')),
            this.addFrameworkTemplate(new ReadmeTemplateBuilder()),
            this.addFrameworkTemplate(
                TemplateBuilder.createStaticTemplate('.gitignore', 'node_modules\n.nuxt\n.output\n.data\n.env\n')
            ),
        ];
    }
}
