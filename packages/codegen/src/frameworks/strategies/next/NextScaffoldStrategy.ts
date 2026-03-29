import { FrameworkScaffoldStrategy } from '../../contracts/FrameworkScaffoldStrategy';
import { TemplateBuilder } from '../../contracts/template/TemplateBuilder';
import type { ScaffoldTemplate } from '../../contracts/template/ScaffoldTemplate';
import { PackageJsonTemplateBuilder } from './templates/packageJson';
import { TsConfigTemplateBuilder } from './templates/tsconfig';
import { TangoConfigTemplateBuilder } from './templates/tangoConfig';
import { TodoModelTemplateBuilder, ModelsBarrelTemplateBuilder } from './templates/models';
import { TodoSerializerTemplateBuilder, SerializersBarrelTemplateBuilder } from './templates/serializers';
import { OpenAPITemplateBuilder } from './templates/openapi';
import { ViewSetTemplateBuilder } from './templates/viewSet';
import { PageTemplateBuilder } from './templates/page';
import { LayoutTemplateBuilder } from './templates/layout';
import { HealthRouteTemplateBuilder } from './templates/healthRoute';
import { TodoRouteTemplateBuilder } from './templates/todoRoute';
import { OpenAPIRouteTemplateBuilder } from './templates/openapiRoute';
import { BootstrapTemplateBuilder } from './templates/bootstrap';
import { ReadmeTemplateBuilder } from './templates/readme';

/**
 * Scaffold strategy for creating a Next.js-hosted Tango project.
 */
export class NextScaffoldStrategy extends FrameworkScaffoldStrategy {
    readonly id = 'next' as const;

    readonly name = 'Next.js';

    readonly description = 'Bootstrap a Tango application hosted by Next.js App Router.';

    /**
     * Return the file templates needed for the generated Next.js project.
     */
    getTemplates(): readonly ScaffoldTemplate[] {
        return [
            this.addFrameworkTemplate(new PackageJsonTemplateBuilder()),
            this.addTangoTemplate(new TangoConfigTemplateBuilder()),
            this.addFrameworkTemplate(new TsConfigTemplateBuilder()),
            this.addFrameworkTemplate(
                TemplateBuilder.createStaticTemplate(
                    'next-env.d.ts',
                    '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n'
                )
            ),
            this.addFrameworkTemplate(TemplateBuilder.createStaticTemplate('next.config.mjs', 'export default {};\n')),
            this.addTangoTemplate(new TodoModelTemplateBuilder()),
            this.addTangoTemplate(new ModelsBarrelTemplateBuilder()),
            this.addTangoTemplate(new TodoSerializerTemplateBuilder()),
            this.addTangoTemplate(new SerializersBarrelTemplateBuilder()),
            this.addTangoTemplate(new OpenAPITemplateBuilder()),
            this.addTangoTemplate(new ViewSetTemplateBuilder()),
            this.addFrameworkTemplate(new LayoutTemplateBuilder()),
            this.addFrameworkTemplate(new PageTemplateBuilder()),
            this.addTangoTemplate(new HealthRouteTemplateBuilder()),
            this.addTangoTemplate(new OpenAPIRouteTemplateBuilder()),
            this.addTangoTemplate(new TodoRouteTemplateBuilder()),
            this.addTangoTemplate(new BootstrapTemplateBuilder()),
            this.addFrameworkTemplate(TemplateBuilder.createStaticTemplate('migrations/.gitkeep', '')),
            this.addFrameworkTemplate(new ReadmeTemplateBuilder()),
            this.addFrameworkTemplate(
                TemplateBuilder.createStaticTemplate('.gitignore', 'node_modules\n.next\n.data\n.env\n')
            ),
        ];
    }
}
