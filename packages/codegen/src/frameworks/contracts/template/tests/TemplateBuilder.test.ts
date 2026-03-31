import { describe, expect, it } from 'vitest';
import { TemplateBuilder } from '../TemplateBuilder';
import type { FrameworkScaffoldContext } from '../ScaffoldTemplate';

const context: FrameworkScaffoldContext = {
    projectName: 'demo',
    targetDir: '/tmp/demo',
    framework: 'next',
    packageManager: 'pnpm',
    dialect: 'sqlite',
    includeSeed: true,
};

describe(TemplateBuilder, () => {
    it('throws when build is called before context is bound', () => {
        const template = TemplateBuilder.createStaticTemplate('demo.txt', 'hello');

        expect(() => template.build()).toThrow(
            'TemplateBuilder: context not bound. Call .setContext(context) before .build().'
        );
    });

    it('supports function-backed static templates once context is bound', () => {
        const template = TemplateBuilder.createStaticTemplate('demo.txt', () => 'computed');

        expect(template.setContext(context).build()).toBe('computed');
    });

    it('formats npm install instructions with npm-specific commands', () => {
        const oneLiner = TemplateBuilder.getTangoInstallOneLiner('npm', 'postgres', 'express');

        expect(oneLiner).toContain('npm install ');
        expect(oneLiner).toContain('npm install -D ');
        expect(oneLiner).toContain('@danceroutine/tango-adapters-express@');
        expect(oneLiner).toContain('pg@^8.16.3');
    });

    it('formats Nuxt install instructions with the Nuxt adapter package', () => {
        const oneLiner = TemplateBuilder.getTangoInstallOneLiner('pnpm', 'sqlite', 'nuxt');

        expect(oneLiner).toContain('@danceroutine/tango-adapters-nuxt@');
        expect(oneLiner).toContain('better-sqlite3@^11.10.0');
    });
});
