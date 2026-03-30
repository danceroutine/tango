import { defineConfig } from 'vitepress';

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

const base = normalizeBase(process.env.TANGO_DOCS_BASE ?? '/tango/');
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
            { text: 'Guide', link: '/guide/' },
            { text: 'Tutorials', link: '/tutorials/' },
            { text: 'Topics', link: '/topics/' },
            { text: 'How-to', link: '/how-to/' },
            { text: 'Reference', link: '/reference/' },
            { text: 'Contributors', link: '/contributors/' },
            {
                text: 'v0.0.0',
                items: [{ text: 'Changelog', link: 'https://github.com/danceroutine/tango/releases' }],
            },
        ],

        sidebar: {
            '/guide/': [
                {
                    text: 'Guide',
                    items: [
                        { text: 'Guide overview', link: '/guide/' },
                        { text: 'Getting started', link: '/guide/getting-started' },
                        { text: 'Installation (users)', link: '/guide/installation' },
                        { text: 'Overview', link: '/guide/overview' },
                        { text: 'Supported and unsupported features', link: '/guide/supported-and-unsupported' },
                        { text: 'Quickstart', link: '/quickstart' },
                    ],
                },
            ],
            '/tutorials/': [
                {
                    text: 'Tutorials',
                    items: [
                        { text: 'Tutorials overview', link: '/tutorials/' },
                        { text: 'Blog API (Express + SQLite)', link: '/tutorials/blog-api' },
                        { text: 'Next.js blog (App Router + SQLite)', link: '/tutorials/nextjs-blog' },
                    ],
                },
            ],
            '/topics/': [
                {
                    text: 'Topics',
                    items: [
                        { text: 'Topics overview', link: '/topics/' },
                        { text: 'Architecture', link: '/topics/architecture' },
                        { text: 'Models and schema', link: '/topics/models-and-schema' },
                        { text: 'ORM and repositories', link: '/topics/orm-and-repositories' },
                        { text: 'Resources and ViewSets', link: '/topics/resources-and-viewsets' },
                        { text: 'Serializers', link: '/topics/serializers' },
                        { text: 'Model lifecycle hooks', link: '/topics/model-lifecycle-hooks' },
                        { text: 'Migrations', link: '/topics/migrations' },
                        { text: 'Testing', link: '/topics/testing' },
                    ],
                },
            ],
            '/how-to/': [
                {
                    text: 'How-to',
                    items: [
                        { text: 'How-to overview', link: '/how-to/' },
                        { text: 'Configure databases', link: '/how-to/databases' },
                        { text: 'Run Tango in CI/CD', link: '/how-to/ci-cd-pipelines' },
                        { text: 'Publish an OpenAPI document', link: '/how-to/publish-openapi-document' },
                        { text: 'Generate and apply migrations', link: '/how-to/generate-and-apply-migrations' },
                        { text: 'Add filtering', link: '/how-to/filtering' },
                        { text: 'Add pagination', link: '/how-to/pagination' },
                        { text: 'Build a model-backed serializer', link: '/how-to/build-a-model-serializer' },
                        {
                            text: 'Move persistence rules into model hooks',
                            link: '/how-to/move-persistence-rules-into-model-hooks',
                        },
                        { text: 'Define custom viewset actions', link: '/how-to/custom-viewset-actions' },
                        { text: 'Filtering and pagination', link: '/how-to/filtering-and-pagination' },
                    ],
                },
            ],
            '/reference/': [
                {
                    text: 'Reference',
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
                    items: [
                        { text: 'Overview', link: '/contributors/' },
                        { text: 'Setup', link: '/contributors/setup' },
                        { text: 'Releasing packages', link: '/contributors/releasing' },
                        { text: 'Contributing guidelines', link: '/contributing' },
                    ],
                },
                {
                    text: 'Contributor topics',
                    items: [
                        { text: 'Topics overview', link: '/contributors/topics/' },
                        { text: 'Dialects in Tango', link: '/contributors/topics/dialects' },
                    ],
                },
                {
                    text: 'Contributor how-to',
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
