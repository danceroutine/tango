import { FrameworkScaffoldStrategy } from '../../contracts/FrameworkScaffoldStrategy';
import { TemplateBuilder } from '../../contracts/template/TemplateBuilder';
import type { ScaffoldTemplate } from '../../contracts/template/ScaffoldTemplate';
import { PackageJsonTemplateBuilder } from './templates/packageJson';
import { TsConfigTemplateBuilder } from './templates/tsconfig';
import { TsConfigBuildTemplateBuilder } from './templates/tsconfigBuild';
import { TangoConfigTemplateBuilder } from './templates/tangoConfig';
import { AppSourceTemplateBuilder } from './templates/appSource';
import { TodoModelTemplateBuilder, ModelsBarrelTemplateBuilder } from './templates/models';
import { TodoSerializerTemplateBuilder, SerializersBarrelTemplateBuilder } from './templates/serializers';
import { OpenAPITemplateBuilder } from './templates/openapi';
import { ViewSetTemplateBuilder } from './templates/viewSet';
import { BootstrapTemplateBuilder } from './templates/bootstrap';
import { ReadmeTemplateBuilder } from './templates/readme';
import { TangoRegisterTemplateBuilder } from './templates/tangoRegister';

/**
 * Scaffold strategy for creating an Express-hosted Tango project.
 */
export class ExpressScaffoldStrategy extends FrameworkScaffoldStrategy {
    readonly id = 'express' as const;

    readonly name = 'Express';

    readonly description = 'Bootstrap a Tango application hosted by Express.';

    /**
     * Return the file templates needed for the generated Express project.
     */
    getTemplates(): readonly ScaffoldTemplate[] {
        return [
            this.addFrameworkTemplate(new PackageJsonTemplateBuilder()),
            this.addFrameworkTemplate(new TsConfigTemplateBuilder()),
            this.addFrameworkTemplate(new TsConfigBuildTemplateBuilder()),
            this.addTangoTemplate(new TangoConfigTemplateBuilder()),
            this.addFrameworkTemplate(new AppSourceTemplateBuilder()),
            this.addTangoTemplate(new TodoModelTemplateBuilder()),
            this.addTangoTemplate(new ModelsBarrelTemplateBuilder()),
            this.addTangoTemplate(new TodoSerializerTemplateBuilder()),
            this.addTangoTemplate(new SerializersBarrelTemplateBuilder()),
            this.addTangoTemplate(new OpenAPITemplateBuilder()),
            this.addTangoTemplate(new ViewSetTemplateBuilder()),
            this.addTangoTemplate(new BootstrapTemplateBuilder()),
            this.addFrameworkTemplate(TemplateBuilder.createStaticTemplate('migrations/.gitkeep', '')),
            this.addFrameworkTemplate(new ReadmeTemplateBuilder()),
            this.addFrameworkTemplate(
                TemplateBuilder.createStaticTemplate('.gitignore', 'node_modules\ndist\n.data\n.env\n')
            ),
            this.addTangoTemplate(new TangoRegisterTemplateBuilder()),
        ];
    }
}
