import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "G-Rump",
  description: "AI-Powered Development Assistant - Transform ideas into production-ready code",
  
  head: [
    ['link', { rel: 'icon', href: '/grump-logo.svg' }],
    ['meta', { name: 'theme-color', content: '#6366f1' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'G-Rump - AI-Powered Development Assistant' }],
    ['meta', { property: 'og:description', content: 'Transform ideas into production-ready code with the SHIP workflow' }],
    ['meta', { property: 'og:image', content: '/grump-og-image.png' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
  ],

  themeConfig: {
    logo: '/grump-logo.svg',
    siteTitle: 'G-Rump',
    
    // Navigation bar
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/getting-started' },
      { 
        text: 'Reference', 
        items: [
          { text: 'CLI Reference', link: '/guide/cli-reference' },
          { text: 'API Reference', link: '/guide/api-reference' },
          { text: 'Configuration', link: '/guide/configuration' },
        ]
      },
      { text: 'Downloads', link: '/downloads' },
      { 
        text: 'Resources',
        items: [
          { text: 'Troubleshooting', link: '/guide/troubleshooting' },
          { text: 'Credits & Pricing', link: '/guide/credits-pricing' },
          { text: 'NVIDIA Models', link: '/guide/nvidia-models' },
          { text: 'Templates', link: '/guide/templates' },
        ]
      },
    ],

    // Sidebar navigation
    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          collapsed: false,
          items: [
            { text: 'What is G-Rump?', link: '/guide/what-is-grump' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Quick Start', link: '/guide/quick-start' },
            { text: 'Installation', link: '/guide/installation' },
          ]
        },
        {
          text: 'Core Concepts',
          collapsed: false,
          items: [
            { text: 'SHIP Workflow', link: '/guide/ship-workflow' },
            { text: 'Intent Compiler', link: '/guide/intent-compiler' },
            { text: 'Multi-Agent System', link: '/guide/agents' },
            { text: 'Architecture Mode', link: '/guide/architecture-mode' },
            { text: 'Code Mode', link: '/guide/code-mode' },
          ]
        },
        {
          text: 'Reference',
          collapsed: false,
          items: [
            { text: 'CLI Reference', link: '/guide/cli-reference' },
            { text: 'API Reference', link: '/guide/api-reference' },
            { text: 'Configuration', link: '/guide/configuration' },
          ]
        },
        {
          text: 'Deployment',
          collapsed: false,
          items: [
            { text: 'Deployment Guide', link: '/guide/deployment' },
            { text: 'Docker Setup', link: '/guide/docker' },
            { text: 'Production Checklist', link: '/guide/production' },
            { text: 'Building from Source', link: '/guide/building' },
            { text: 'Electron Setup', link: '/guide/electron-setup' },
          ]
        },
        {
          text: 'Resources',
          collapsed: false,
          items: [
            { text: 'Project Templates', link: '/guide/templates' },
            { text: 'NVIDIA Models', link: '/guide/nvidia-models' },
            { text: 'Credits & Pricing', link: '/guide/credits-pricing' },
            { text: 'Troubleshooting', link: '/guide/troubleshooting' },
          ]
        },
      ],
    },

    // Social links
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Aphrodine-wq/G-rump.com' },
      { icon: 'discord', link: 'https://discord.gg/grump' },
    ],

    // Footer
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright 2024-present G-Rump Team'
    },

    // Edit link
    editLink: {
      pattern: 'https://github.com/Aphrodine-wq/G-rump.com/edit/main/docs-site/:path',
      text: 'Edit this page on GitHub'
    },

    // Search
    search: {
      provider: 'local',
      options: {
        detailedView: true,
      }
    },

    // Last updated
    lastUpdated: {
      text: 'Updated at',
      formatOptions: {
        dateStyle: 'medium',
        timeStyle: 'short'
      }
    },

    // Doc footer
    docFooter: {
      prev: 'Previous',
      next: 'Next'
    },

    // Outline
    outline: {
      level: [2, 3],
      label: 'On this page'
    },

    // Carbon ads (optional)
    // carbonAds: {
    //   code: 'your-carbon-code',
    //   placement: 'your-carbon-placement'
    // }
  },

  // Markdown config
  markdown: {
    lineNumbers: true,
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    }
  },

  // Build config
  cleanUrls: true,
  lastUpdated: true,

  // Sitemap
  sitemap: {
    hostname: 'https://grump.dev'
  }
})
