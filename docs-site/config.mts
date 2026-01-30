import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "G-Rump Docs",
  description: "Documentation for G-Rump AI Development Assistant",
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/grump-logo.svg' }],
    ['meta', { name: 'theme-color', content: '#7C3AED' }]
  ],
  ignoreDeadLinks: true,
  themeConfig: {
    logo: '/grump-logo.svg',
    siteTitle: 'G-Rump',
    
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/overview' },
      { text: 'CLI', link: '/cli/commands' },
      { text: 'Download', link: '/downloads' }
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'What is G-Rump?', link: '/guide/what-is-grump' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Quick Start', link: '/guide/quick-start' },
            { text: 'Installation', link: '/guide/installation' }
          ]
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'SHIP Workflow', link: '/guide/ship-workflow' },
            { text: 'Intent Compiler', link: '/guide/intent-compiler' },
            { text: 'Multi-Agent System', link: '/guide/agents' },
            { text: 'Architecture Mode', link: '/guide/architecture-mode' },
            { text: 'Code Mode', link: '/guide/code-mode' }
          ]
        },
        {
          text: 'Desktop App',
          items: [
            { text: 'Electron Setup', link: '/guide/electron-setup' },
            { text: 'Configuration', link: '/guide/configuration' },
            { text: 'Building from Source', link: '/guide/building' }
          ]
        },
        {
          text: 'Deployment',
          items: [
            { text: 'Production Checklist', link: '/guide/production' },
            { text: 'Docker Deployment', link: '/guide/docker' },
            { text: 'Security', link: '/guide/security' }
          ]
        }
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/overview' },
            { text: 'Authentication', link: '/api/authentication' },
            { text: 'Chat Endpoints', link: '/api/chat' },
            { text: 'SHIP Endpoints', link: '/api/ship' },
            { text: 'Codegen Endpoints', link: '/api/codegen' },
            { text: 'Architecture Endpoints', link: '/api/architecture' },
            { text: 'Webhooks', link: '/api/webhooks' },
            { text: 'Error Handling', link: '/api/errors' }
          ]
        }
      ],
      '/cli/': [
        {
          text: 'CLI Reference',
          items: [
            { text: 'Commands', link: '/cli/commands' },
            { text: 'Configuration', link: '/cli/configuration' },
            { text: 'Examples', link: '/cli/examples' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Aphrodine-wq/G-rump.com' }
    ],
    
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025 G-Rump'
    },
    
    search: {
      provider: 'local'
    },
    
    editLink: {
      pattern: 'https://github.com/Aphrodine-wq/G-rump.com/edit/main/docs-site/:path',
      text: 'Edit this page on GitHub'
    }
  },
  
  appearance: true,
  lastUpdated: true,
  
  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    },
    lineNumbers: true
  }
})
