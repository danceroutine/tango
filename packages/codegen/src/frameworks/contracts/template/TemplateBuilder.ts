import packageJson from '../../../../package.json';
import { PACKAGE_MANAGER, type PackageManager } from '../FrameworkScaffoldStrategy';
import type { FrameworkScaffoldContext } from './ScaffoldTemplate';

const { version } = packageJson as { version: string };

/**
 * Interface for a context-bound template that the strategy's add* methods accept.
 * Implemented by bound TemplateBuilder instances and by the return value of createStaticTemplate.
 */
export interface BoundTemplate {
    getPath(): string;
    build(): string;
}

/**
 * Base class for scaffold template builders. Subclasses override resolveTemplate().
 * Use new WhateverBuilder().setContext(context) for registration with add* methods.
 * Deps logic (getTangoDependencyEntries, getTangoDevDependencyEntries) and version live here.
 */
export abstract class TemplateBuilder implements BoundTemplate {
    protected readonly name: string;
    protected _context?: FrameworkScaffoldContext;

    constructor(options: { name: string }) {
        this.name = options.name;
    }

    /**
     * One-liner to install Tango + dialect deps and Tango CLI (for init success message).
     */
    static getTangoInstallOneLiner(
        packageManager: PackageManager,
        dialect: 'sqlite' | 'postgres',
        framework: 'express' | 'next' | 'nuxt'
    ): string {
        const deps = TemplateBuilder.getTangoDependencyEntriesFor(dialect, framework);
        const devDeps = TemplateBuilder.getTangoDevDependencyEntriesFor();
        const depList = Object.entries(deps)
            .map(([pkg, ver]) => `${pkg}@${ver}`)
            .join(' ');
        const devList = Object.entries(devDeps)
            .map(([pkg, ver]) => `${pkg}@${ver}`)
            .join(' ');
        const addCmd = packageManager === 'npm' ? 'npm install' : `${packageManager} add`;
        const addDevCmd = packageManager === 'npm' ? 'npm install -D' : `${packageManager} add -D`;
        return `${addCmd} ${depList} && ${addDevCmd} ${devList}`;
    }

    static getRunScriptCommand(
        packageManager: PackageManager,
        scriptName: string,
        scriptArgs: readonly string[] = []
    ): string {
        const serializedArgs = scriptArgs.join(' ');

        switch (packageManager) {
            case PACKAGE_MANAGER.NPM:
                return serializedArgs.length > 0
                    ? `npm run ${scriptName} -- ${serializedArgs}`
                    : `npm run ${scriptName}`;
            case PACKAGE_MANAGER.YARN:
                return serializedArgs.length > 0
                    ? `yarn run ${scriptName} ${serializedArgs}`
                    : `yarn run ${scriptName}`;
            case PACKAGE_MANAGER.BUN:
                return serializedArgs.length > 0 ? `bun run ${scriptName} ${serializedArgs}` : `bun run ${scriptName}`;
            case PACKAGE_MANAGER.PNPM:
            default:
                return serializedArgs.length > 0
                    ? `pnpm run ${scriptName} ${serializedArgs}`
                    : `pnpm run ${scriptName}`;
        }
    }

    /**
     * Shorthand for static content (no subclass needed). Returns a BoundTemplate that add* methods accept.
     */
    static createStaticTemplate(fileName: string, template: string | (() => string)): TemplateBuilder {
        class TransientStaticTemplateBuilder extends TemplateBuilder {
            protected override resolveTemplate(_context: FrameworkScaffoldContext): string {
                return typeof template === 'string' ? template : template();
            }
        }
        return new TransientStaticTemplateBuilder({ name: fileName });
    }

    /** Tango package version (semver range) for scaffolded dependency entries. */
    private static getTangoVersion(): string {
        return `^${version}`;
    }

    private static getTangoDependencyEntriesFor(
        _dialect: 'sqlite' | 'postgres',
        framework: 'express' | 'next' | 'nuxt'
    ): Record<string, string> {
        const v = TemplateBuilder.getTangoVersion();
        const core: Record<string, string> = {
            '@danceroutine/tango-core': v,
            '@danceroutine/tango-schema': v,
            '@danceroutine/tango-orm': v,
            '@danceroutine/tango-resources': v,
            '@danceroutine/tango-migrations': v,
            '@danceroutine/tango-openapi': v,
            '@danceroutine/tango-config': v,
        };
        const adapter: Record<string, string> =
            framework === 'express'
                ? { '@danceroutine/tango-adapters-express': v }
                : framework === 'next'
                  ? { '@danceroutine/tango-adapters-next': v }
                  : { '@danceroutine/tango-adapters-nuxt': v };
        const dialectDeps: Record<string, string> = {
            'better-sqlite3': '^11.10.0',
            pg: '^8.16.3',
        };
        return { ...core, ...adapter, ...dialectDeps };
    }

    private static getTangoDevDependencyEntriesFor(): Record<string, string> {
        return {
            '@danceroutine/tango-cli': TemplateBuilder.getTangoVersion(),
            '@types/better-sqlite3': '^7.6.12',
        };
    }

    /** Bind context and return this for chaining. Use before passing to add* methods. */
    setContext(context: FrameworkScaffoldContext): this {
        this._context = context;
        return this;
    }

    getPath(): string {
        return this.name;
    }

    protected abstract resolveTemplate(context: FrameworkScaffoldContext): string;

    build(): string {
        if (this._context === undefined) {
            throw new Error('TemplateBuilder: context not bound. Call .setContext(context) before .build().');
        }
        return this.resolveTemplate(this._context);
    }

    protected getTangoDependencyEntries(context: FrameworkScaffoldContext): Record<string, string> {
        return TemplateBuilder.getTangoDependencyEntriesFor(context.dialect, context.framework);
    }

    protected getTangoDevDependencyEntries(_context: FrameworkScaffoldContext): Record<string, string> {
        return TemplateBuilder.getTangoDevDependencyEntriesFor();
    }
}
