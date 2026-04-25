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
        expect(oneLiner).toContain('better-sqlite3@^11.10.0');
        expect(oneLiner).toContain('pg@^8.16.3');
        expect(oneLiner).toContain('@types/better-sqlite3@^7.6.12');
    });

    it('formats Nuxt install instructions with the Nuxt adapter package', () => {
        const oneLiner = TemplateBuilder.getTangoInstallOneLiner('pnpm', 'sqlite', 'nuxt');

        expect(oneLiner).toContain('@danceroutine/tango-adapters-nuxt@');
        expect(oneLiner).toContain('better-sqlite3@^11.10.0');
        expect(oneLiner).toContain('pg@^8.16.3');
        expect(oneLiner).toContain('@types/better-sqlite3@^7.6.12');
    });

    it('formats npm script forwarding with an explicit separator', () => {
        expect(TemplateBuilder.getRunScriptCommand('npm', 'make:migrations', ['--name', 'initial'])).toBe(
            'npm run make:migrations -- --name initial'
        );
    });

    it('formats pnpm script forwarding without a literal separator arg', () => {
        expect(TemplateBuilder.getRunScriptCommand('pnpm', 'make:migrations', ['--name', 'initial'])).toBe(
            'pnpm run make:migrations --name initial'
        );
    });

    it('formats yarn and bun script forwarding without npm-specific separators', () => {
        expect(TemplateBuilder.getRunScriptCommand('yarn', 'make:migrations', ['--name', 'initial'])).toBe(
            'yarn run make:migrations --name initial'
        );
        expect(TemplateBuilder.getRunScriptCommand('bun', 'make:migrations', ['--name', 'initial'])).toBe(
            'bun run make:migrations --name initial'
        );
    });

    it('formats script invocations with no forwarded args', () => {
        expect(TemplateBuilder.getRunScriptCommand('pnpm', 'dev')).toBe('pnpm run dev');
        expect(TemplateBuilder.getRunScriptCommand('npm', 'dev')).toBe('npm run dev');
        expect(TemplateBuilder.getRunScriptCommand('yarn', 'dev')).toBe('yarn run dev');
        expect(TemplateBuilder.getRunScriptCommand('bun', 'dev')).toBe('bun run dev');
    });
});
