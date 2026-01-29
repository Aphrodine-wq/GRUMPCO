import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "G-Rump Docs",
  description: "Documentation for G-Rump AI Assistant",
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/getting-started' }
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Overview', link: '/OVERVIEW' },
          { text: 'Quick Start', link: '/QUICK_START' },
          { text: 'How It Works', link: '/HOW_IT_WORKS' }
        ]
      },
      {
        text: 'Architecture',
        items: [
          { text: 'System Architecture', link: '/SYSTEM_ARCHITECTURE' },
          { text: 'Agent System', link: '/AGENT_SYSTEM' },
          { text: 'Intent Compiler', link: '/INTENT_COMPILER' }
        ]
      },
      {
        text: 'Development',
        items: [
          { text: 'Testing', link: '/TESTING' },
          { text: 'Capabilities', link: '/CAPABILITIES' },
          { text: 'Production Checklist', link: '/PRODUCTION_CHECKLIST' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/milesproject' }
    ]
  },
  // We will map the root docs folder to be available here, 
  // currently we are assuming the docs are copied or we configure srcDir if possible.
  // For simplicity in this plan, I'll copy the critical docs to docs-site/
  // or I can actually set the srcDir to ../docs? 
  // Setting srcDir to ../docs might be messy with node_modules. 
  // Let's just assume we will copy the files for now or I'll create a script to do it.
  ignoreDeadLinks: true,
  srcDir: '../docs'
})
