import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitepress';

type PackageManifest = {
    version?: string;
};

function normalizeBase(base: string): string {
    const trimmed = base.trim();
    if (!trimmed || trimmed === '/') {
        return '/';
    }

    return `/${trimmed.replace(/^\/+|\/+$/g, '')}/`;
}

function toBasePath(base: string, path: string): string {
    if (!path.startsWith('/')) {
        return path;
    }

    if (base === '/') {
        return path;
    }

    return `${base}${path.replace(/^\/+/, '')}`;
}

const base = normalizeBase(process.env.TANGO_DOCS_BASE ?? '/');
const packageManifestPath = resolve(import.meta.dirname, '../../packages/core/package.json');
const publicVersion = (JSON.parse(readFileSync(packageManifestPath, 'utf8')) as PackageManifest).version ?? '0.0.0';

export default defineConfig({
    title: 'Tango',
    description: 'Batteries-included TypeScript framework inspired by Django and DRF.',
    base,
    cleanUrls: true,

    head: [
        ['link', { rel: 'icon', href: toBasePath(base, '/favicon.ico') }],
        ['link', { rel: 'mask-icon', href: toBasePath(base, '/logo-mark.svg'), color: '#8C2F39' }],
        ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
        ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
        [
            'link',
            {
                rel: 'stylesheet',
                href: 'https://fonts.googleapis.com/css2?family=Baloo+Thambi+2:wght@400..800&display=swap',
            },
        ],
    ],

    themeConfig: {
        logo: {
            light: '/logo-mark.svg',
            dark: '/logo-mark.svg',
        },

        nav: [
            { text: 'Guides', link: '/guide/' },
            { text: 'Tutorials', link: '/tutorials/' },
            { text: 'Topics', link: '/topics/' },
            { text: 'How-to', link: '/how-to/' },
            { text: 'Reference', link: '/reference/' },
            { text: 'Roadmap', link: '/roadmap' },
            { text: 'Contributors', link: '/contributors/' },
            {
                text: `v${publicVersion}`,
                items: [{ text: 'Changelog', link: 'https://github.com/danceroutine/tango/blob/master/CHANGELOG.md' }],
            },
        ],

        sidebar: {
            '/guide/': [
                {
                    text: 'Guide',
                    collapsed: true,
                    items: [
                        { text: 'Guide overview', link: '/guide/' },
                        { text: 'Getting started', link: '/guide/getting-started' },
                        { text: 'Installation (users)', link: '/guide/installation' },
                        { text: 'Overview', link: '/guide/overview' },
                        { text: 'Supported and unsupported features', link: '/guide/supported-and-unsupported' },
                    ],
                },
            ],
            '/tutorials/': [
                {
                    text: 'Tutorials',
                    collapsed: true,
                    items: [
                        { text: 'Tutorials overview', link: '/tutorials/' },
                        { text: 'Blog API (Express + SQLite)', link: '/tutorials/express-blog-api' },
                        { text: 'Next.js blog (App Router + SQLite)', link: '/tutorials/nextjs-blog' },
                        { text: 'Nuxt blog (Nitro + SQLite)', link: '/tutorials/nuxt-blog' },
                    ],
                },
            ],
            '/topics/': [
                {
                    text: 'Topics',
                    collapsed: true,
                    items: [
                        { text: 'Topics overview', link: '/topics/' },
                        { text: 'Architecture', link: '/topics/architecture' },
                        { text: 'Models and schema', link: '/topics/models-and-schema' },
                        { text: 'ORM and QuerySets', link: '/topics/orm-and-querysets' },
                        { text: 'API layer', link: '/topics/api-layer' },
                        { text: 'Migrations', link: '/topics/migrations' },
                        { text: 'Testing', link: '/topics/testing' },
                    ],
                },
            ],
            '/how-to/': [
                {
                    text: 'How-to',
                    collapsed: true,
                    items: [
                        { text: 'How-to overview', link: '/how-to/' },
                        { text: 'Configure databases', link: '/how-to/databases' },
                        { text: 'Run Tango in CI/CD', link: '/how-to/ci-cd-pipelines' },
                        { text: 'Auto-document your API', link: '/how-to/auto-document-your-api' },
                        { text: 'Work with models', link: '/how-to/work-with-models' },
                        { text: 'Work with serializers', link: '/how-to/working-with-serializers' },
                        { text: 'Build your API with viewsets', link: '/how-to/build-your-api-with-viewsets' },
                        { text: 'Add pagination', link: '/how-to/pagination' },
                    ],
                },
            ],
            '/reference/': [
                {
                    text: 'Reference',
                    collapsed: true,
                    items: [
                        { text: 'Reference overview', link: '/reference/' },
                        { text: 'Config API', link: '/reference/config-api' },
                        { text: 'CLI API', link: '/reference/cli-api' },
                        { text: 'OpenAPI API', link: '/reference/openapi-api' },
                        { text: 'Schema API', link: '/reference/schema-api' },
                        { text: 'ORM query API', link: '/reference/orm-query-api' },
                        { text: 'Resources API', link: '/reference/resources-api' },
                    ],
                },
            ],
            '/contributors/': [
                {
                    text: 'Contributors',
                    collapsed: true,
                    items: [
                        { text: 'Overview', link: '/contributors/' },
                        { text: 'Setup', link: '/contributors/setup' },
                        { text: 'Releasing packages', link: '/contributors/releasing' },
                        { text: 'Contributing code', link: '/contributors/contributing-code' },
                        { text: 'Writing documentation', link: '/contributors/writing-documentation' },
                    ],
                },
                {
                    text: 'Contributor topics',
                    collapsed: true,
                    items: [
                        { text: 'Topics overview', link: '/contributors/topics/' },
                        { text: 'Dialects in Tango', link: '/contributors/topics/dialects' },
                        {
                            text: 'Foreign Keys, Many-to-Many, and the Relation Seam',
                            link: '/contributors/topics/resolved-relation-graph',
                        },
                    ],
                },
                {
                    text: 'Contributor ADRs',
                    collapsed: true,
                    items: [
                        { text: 'ADR overview', link: '/contributors/adr/' },
                        {
                            text: '2026-04-06 Relation target typing without codegen',
                            link: '/contributors/adr/relation-target-typing-without-codegen',
                        },
                    ],
                },
                {
                    text: 'Contributor how-to',
                    collapsed: true,
                    items: [
                        { text: 'How-to guides', link: '/contributors/how-to/' },
                        {
                            text: 'Onboard a new database dialect',
                            link: '/contributors/how-to/new-dialect-onboarding',
                        },
                    ],
                },
            ],
            '/api/': [
                {
                    text: 'Reference',
                    collapsed: true,
                    items: [{ text: 'Schema API', link: '/reference/schema-api' }],
                },
            ],
        },

        socialLinks: [{ icon: 'github', link: 'https://github.com/danceroutine/tango' }],

        footer: {
            message: 'Released under the MIT License.',
            copyright: 'Copyright © 2025 Pedro Del Moral Lopez',
        },

        search: {
            provider: 'local',
        },
    },
});
