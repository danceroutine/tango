import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Tango',
  description: 'TypeScript Web Framework inspired by Django and DRF',
  base: '/',
  cleanUrls: true,
  
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/' },
      {
        text: 'v0.0.0',
        items: [
          { text: 'Changelog', link: 'https://github.com/pmorales01/tango/releases' },
        ],
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' },
          ],
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Overview', link: '/guide/overview' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Index', link: '/api/' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/pmorales01/tango' },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025 Pedro Del Moral Lopez',
    },

    search: {
      provider: 'local',
    },
  },
});

