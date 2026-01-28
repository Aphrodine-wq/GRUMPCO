/**
 * Template marketplace - pre-built project templates and versioning.
 */
export interface Template {
  id: string
  name: string
  description: string
  version: string
  author?: string
  tags: string[]
  prdSnippet?: string
  createdAt: string
}

const BUILTIN_TEMPLATES: Template[] = [
  {
    id: 'rest-api-node',
    name: 'REST API (Node + Express)',
    description: 'Starter for a Node.js REST API with TypeScript and health check.',
    version: '1.0.0',
    author: 'G-Rump',
    tags: ['node', 'express', 'rest', 'typescript'],
    prdSnippet: 'REST API with health, CRUD, and OpenAPI',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'vue-dashboard',
    name: 'Vue 3 Dashboard',
    description: 'Vue 3 + TypeScript dashboard with layout and routing.',
    version: '1.0.0',
    author: 'G-Rump',
    tags: ['vue', 'dashboard', 'typescript'],
    prdSnippet: 'Dashboard with sidebar, charts, and tables',
    createdAt: new Date().toISOString(),
  },
]

export function listTemplates(query?: string, tags?: string[]): Template[] {
  let out = [...BUILTIN_TEMPLATES]
  if (query) {
    const q = query.toLowerCase()
    out = out.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
    )
  }
  if (tags?.length) {
    out = out.filter((t) => tags.every((tag) => t.tags.includes(tag)))
  }
  return out
}

export function getTemplate(id: string): Template | null {
  return BUILTIN_TEMPLATES.find((t) => t.id === id) ?? null
}
