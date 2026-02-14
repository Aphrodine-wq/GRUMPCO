/**
 * Mermaid diagram parser for Builder section cards.
 * Extracts subgraphs and top-level nodes to build { id, title }[] for section cards.
 * Uses stable ids (sanitized) so backend and frontend agree on section identity.
 */

// CSS.escape type declaration for browsers that support it
declare const CSS: {
  escape(str: string): string;
};

export interface MermaidSection {
  id: string;
  title: string;
}

/**
 * Sanitize a string to a stable id: alphanumeric and hyphens only, lowercase.
 */
function toStableId(raw: string): string {
  return (
    raw
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'section'
  );
}

/**
 * Parse Mermaid diagram code into sections for Builder cards.
 * - Prefer subgraph blocks: id and/or title become section id and title.
 * - Fallback: top-level node definitions (id or id[label]) become sections.
 * Order is preserved (subgraphs first in document order, then nodes).
 */
export function parseMermaidSections(mermaidCode: string): MermaidSection[] {
  const sections: MermaidSection[] = [];
  const seenIds = new Set<string>();

  if (!mermaidCode || typeof mermaidCode !== 'string') return sections;

  const code = mermaidCode.trim();
  // Strip leading diagram type (flowchart, graph, etc.) for consistent parsing
  const body = code.replace(
    /^\s*(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram)\s+/i,
    ''
  );

  // 1) Subgraphs: subgraph id["label"] or subgraph id or subgraph label
  const subgraphRe = /subgraph\s+([^\n[\]]+)(?:\[([^\]]*)\])?\s*[\n\s]*([\s\S]*?)end/g;
  let m: RegExpExecArray | null;
  while ((m = subgraphRe.exec(body)) !== null) {
    const rawId = m[1].trim();
    const bracketLabel = m[2]?.trim();
    const id = toStableId(rawId);
    const title = bracketLabel || rawId;
    if (id && !seenIds.has(id)) {
      seenIds.add(id);
      sections.push({ id, title });
    }
  }

  // 2) If we have subgraphs, return them only (don't mix with top-level nodes to avoid duplication)
  if (sections.length > 0) return sections;

  // 3) Fallback: top-level node definitions (id or id["label"] or id(label))
  // Match: word or quoted id, optional [label] or (label), optional --> or ---
  const nodeRe = /(\w+|"[^"]*"|'[^']*')\s*(?:\[([^\]]*)\])?\s*(?:\(([^)]*)\))?/g;
  const used = new Set<string>();
  while ((m = nodeRe.exec(body)) !== null) {
    let rawId = m[1].trim();
    if (rawId.startsWith('"') && rawId.endsWith('"')) rawId = rawId.slice(1, -1);
    if (rawId.startsWith("'") && rawId.endsWith("'")) rawId = rawId.slice(1, -1);
    const bracketLabel = m[2]?.trim();
    const parenLabel = m[3]?.trim();
    const title = bracketLabel || parenLabel || rawId;
    const id = toStableId(rawId);
    if (id && id !== 'end' && id !== 'subgraph' && !used.has(id)) {
      used.add(id);
      sections.push({ id, title });
    }
  }

  return sections;
}

// ─── Existing API for DiagramRenderer and tests ─────────────────────────────

export interface MermaidNode {
  id: string;
  label: string;
  type?: string;
}

/**
 * Parse Mermaid code into a map of node id -> { id, label, type? }.
 * Supports flowchart/graph node definitions and C4 syntax.
 */
export function parseMermaidNodes(mermaidCode: string): Record<string, MermaidNode> {
  const nodes: Record<string, MermaidNode> = {};
  if (!mermaidCode || typeof mermaidCode !== 'string') return nodes;
  const code = mermaidCode.trim();
  if (!code) return nodes;

  const body = code.replace(
    /^\s*(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram)\s+/i,
    ''
  );

  function setNode(id: string, label: string, type?: string) {
    const key = id.trim();
    if (!key) return;
    nodes[key] = { id: key, label: label.trim() || key, type };
  }

  // C4: C4Container(id, "Label") or C4Context, etc.
  const c4Re =
    /C4(?:Context|Container|Component|Deployment|Dynamic)\s*\(\s*([^,)]+)\s*,\s*["']([^"']*)["']\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = c4Re.exec(code)) !== null) {
    const id = m[1].trim();
    const label = (m[2] || id).trim();
    setNode(id, label, 'c4');
  }

  // Edges first so edge-only nodes get created: A --> B, A[Start] --> UndefinedTarget, etc.
  const edgeRe =
    /(\w+)(?:\s*\[[^\]]*\])?(?:\s*\([^)]*\))?(?:\s*\{[^}]*\})?\s*[-=.]*>\s*(\w+)|(\w+)\s*---\s*(\w+)/g;
  while ((m = edgeRe.exec(body)) !== null) {
    const a = m[1] ?? m[3];
    const b = m[2] ?? m[4];
    if (a && !nodes[a]) setNode(a, a);
    if (b && !nodes[b]) setNode(b, b);
  }

  // Node definitions: id[label], id(label), id{label}
  const defRe = /(\w+)\s*(\[[^\]]*\]|\([^)]*\)|\{[^}]*\})/g;
  while ((m = defRe.exec(body)) !== null) {
    const id = m[1].trim();
    const inner = m[2].slice(1, -1).trim();
    setNode(id, inner);
  }

  // Standalone node id (e.g. "MyNode" on its own line)
  const standaloneRe = /^\s*(\w+)\s*(?:\n|$)/gm;
  while ((m = standaloneRe.exec(body)) !== null) {
    const id = m[1].trim();
    const skip = /^(TD|TB|BT|LR|RL|end|subgraph)$/i.test(id);
    if (id && !skip && !nodes[id]) setNode(id, id);
  }

  return nodes;
}

export interface ComponentLike {
  id: string;
  name: string;
}

/**
 * Find a component by node id or label (exact and partial match).
 */
export function findComponentByNodeId(
  nodeId: string,
  label: string,
  components: ComponentLike[]
): ComponentLike | null {
  if (!components.length) return null;
  const nid = nodeId.toLowerCase();
  const nlabel = (label || '').toLowerCase();

  const byExactId = components.find((c) => c.id.toLowerCase() === nid);
  if (byExactId) return byExactId;

  const byLabel = components.find((c) => c.name.toLowerCase() === nlabel);
  if (byLabel) return byLabel;

  const byPartialLabel = components.find(
    (c) => c.name.toLowerCase().includes(nlabel) || nlabel.includes(c.name.toLowerCase())
  );
  if (byPartialLabel) return byPartialLabel;

  const byPartialId = components.find(
    (c) => c.id.toLowerCase().includes(nid) || nid.includes(c.id.toLowerCase())
  );
  if (byPartialId) return byPartialId;

  return null;
}

/**
 * Find an SVG element that represents a Mermaid node by id or label.
 */
export function findSvgNodeElement(svg: SVGElement | null, nodeId: string): Element | null {
  if (!svg || !nodeId || !nodeId.trim()) return null;
  const id = nodeId.trim();

  const byClass = svg.querySelector(`g.node-${id}, g[class*="node-${id}"]`);
  if (byClass) return byClass;

  const escapedId =
    typeof CSS !== 'undefined' && CSS.escape
      ? CSS.escape(id)
      : id.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  const byId = svg.querySelector(`#${escapedId}`);
  if (byId) return byId;

  const byData = svg.querySelector(`g[data-node-id="${id}"]`);
  if (byData) return byData;

  const texts = svg.querySelectorAll('text');
  for (const text of texts) {
    if (text.textContent?.trim() === id) {
      let g: Element | null = text.parentElement;
      while (g && g !== (svg as Element)) {
        if (g.tagName.toLowerCase() === 'g') return g;
        g = g.parentElement;
      }
      return text;
    }
  }
  return null;
}
