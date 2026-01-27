<script lang="ts">
  interface Node {
    id: string;
    label: string;
    type?: string;
    children?: Node[];
  }

  interface Props {
    mermaidCode: string;
    onNodeClick?: (nodeId: string) => void;
  }

  let { mermaidCode, onNodeClick }: Props = $props();

  let structure = $state<Node[]>([]);
  let expandedNodes = $state<Set<string>>(new Set());

  // Parse Mermaid diagram to extract structure
  function parseMermaidStructure(code: string): Node[] {
    const nodes: Node[] = [];
    const nodeMap = new Map<string, Node>();
    
    // Extract flowchart/graph nodes
    const flowchartRegex = /flowchart\s+(?:TD|TB|BT|LR|RL|[\s\S]*?)\n([\s\S]*)/i;
    const graphRegex = /graph\s+(?:TD|TB|BT|LR|RL|[\s\S]*?)\n([\s\S]*)/i;
    
    let content = code;
    const flowchartMatch = code.match(flowchartRegex);
    const graphMatch = code.match(graphRegex);
    
    if (flowchartMatch) {
      content = flowchartMatch[1];
    } else if (graphMatch) {
      content = graphMatch[1];
    }

    // Extract node definitions: A[Label] or A --> B
    const nodeDefRegex = /(\w+)(?:\[([^\]]+)\])?/g;
    const edgeRegex = /(\w+)\s*(?:-->|--|==>|==)\s*(\w+)/g;
    
    // First pass: collect all nodes
    let match;
    while ((match = nodeDefRegex.exec(content)) !== null) {
      const nodeId = match[1];
      const label = match[2] || nodeId;
      
      if (!nodeMap.has(nodeId)) {
        const node: Node = {
          id: nodeId,
          label: label.trim(),
          children: [],
        };
        nodeMap.set(nodeId, node);
      } else {
        // Update label if provided
        const existing = nodeMap.get(nodeId)!;
        if (label && label !== nodeId) {
          existing.label = label.trim();
        }
      }
    }

    // Second pass: collect edges to build hierarchy
    const edges: Array<{ from: string; to: string }> = [];
    while ((match = edgeRegex.exec(content)) !== null) {
      const from = match[1];
      const to = match[2];
      edges.push({ from, to });
    }

    // Build tree structure (simple: first node as root, others as children)
    const rootNodes = new Set<string>();
    const childNodes = new Set<string>();
    
    edges.forEach(edge => {
      childNodes.add(edge.to);
      if (!childNodes.has(edge.from)) {
        rootNodes.add(edge.from);
      }
    });

    // If no edges, all nodes are roots
    if (rootNodes.size === 0 && nodeMap.size > 0) {
      rootNodes.add(Array.from(nodeMap.keys())[0]);
    }

    // Build tree
    rootNodes.forEach(rootId => {
      const root = nodeMap.get(rootId);
      if (root) {
        buildTree(root, nodeMap, edges);
        nodes.push(root);
      }
    });

    // Add orphaned nodes
    nodeMap.forEach((node, id) => {
      if (!rootNodes.has(id) && !childNodes.has(id)) {
        nodes.push(node);
      }
    });

    return nodes.length > 0 ? nodes : Array.from(nodeMap.values());
  }

  function buildTree(node: Node, nodeMap: Map<string, Node>, edges: Array<{ from: string; to: string }>) {
    const children = edges
      .filter(e => e.from === node.id)
      .map(e => nodeMap.get(e.to))
      .filter((n): n is Node => n !== undefined);
    
    node.children = children;
    children.forEach(child => {
      buildTree(child, nodeMap, edges);
    });
  }

  function toggleNode(nodeId: string) {
    if (expandedNodes.has(nodeId)) {
      expandedNodes.delete(nodeId);
    } else {
      expandedNodes.add(nodeId);
    }
    expandedNodes = new Set(expandedNodes);
  }

  function handleNodeClick(node: Node, event: MouseEvent) {
    event.stopPropagation();
    if (node.children && node.children.length > 0) {
      toggleNode(node.id);
    }
    onNodeClick?.(node.id);
  }

  $effect(() => {
    if (mermaidCode) {
      structure = parseMermaidStructure(mermaidCode);
      // Expand first level by default
      structure.forEach(node => {
        if (node.children && node.children.length > 0) {
          expandedNodes.add(node.id);
        }
      });
      expandedNodes = new Set(expandedNodes);
    }
  });

</script>

<div class="architecture-preview">
  <div class="preview-header">
    <h3 class="preview-title">Architecture Structure</h3>
  </div>
  <div class="preview-content">
    {#if structure.length === 0}
      <div class="preview-empty">
        No structure detected in diagram
      </div>
    {:else}
      <div class="preview-tree">
        {#each structure as node (node.id)}
          {@render renderTreeNode(node, 0)}
        {/each}
      </div>
    {/if}
  </div>
</div>

{#snippet renderTreeNode(node: Node, level: number)}
  <div class="tree-node" style="padding-left: {level * 1.5}rem">
    <div class="tree-node-content" on:click={() => handleNodeClick(node, new MouseEvent('click'))} role="button" tabindex="0">
      {#if node.children && node.children.length > 0}
        <button class="tree-toggle" on:click|stopPropagation={() => toggleNode(node.id)}>
          {expandedNodes.has(node.id) ? '▼' : '▶'}
        </button>
      {:else}
        <span class="tree-toggle-spacer"></span>
      {/if}
      <span class="tree-node-label">{node.label}</span>
      {#if node.type}
        <span class="tree-node-type">{node.type}</span>
      {/if}
    </div>
    {#if node.children && node.children.length > 0 && expandedNodes.has(node.id)}
      <div class="tree-children">
        {#each node.children as child (child.id)}
          {@render renderTreeNode(child, level + 1)}
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

<style>
  .architecture-preview {
    background: #1a1a1a;
    border: 1px solid #404040;
    border-radius: 8px;
    overflow: hidden;
    font-family: 'JetBrains Mono', monospace;
  }

  .preview-header {
    padding: 1rem;
    background: #0d0d0d;
    border-bottom: 1px solid #404040;
  }

  .preview-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #E5E5E5;
    margin: 0;
  }

  .preview-content {
    padding: 1rem;
    max-height: 400px;
    overflow-y: auto;
  }

  .preview-empty {
    text-align: center;
    color: #6B7280;
    font-size: 0.875rem;
    padding: 2rem;
  }

  .preview-tree {
    display: flex;
    flex-direction: column;
  }

  .tree-node {
    margin: 0.25rem 0;
  }

  .tree-node-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .tree-node-content:hover {
    background: #262626;
  }

  .tree-toggle {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: #6B7280;
    cursor: pointer;
    font-size: 0.75rem;
    padding: 0;
    flex-shrink: 0;
  }

  .tree-toggle:hover {
    color: #E5E5E5;
  }

  .tree-toggle-spacer {
    width: 20px;
    flex-shrink: 0;
  }

  .tree-node-label {
    flex: 1;
    color: #E5E5E5;
    font-size: 0.875rem;
  }

  .tree-node-type {
    color: #6B7280;
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
    background: #0d0d0d;
    border-radius: 3px;
  }

  .tree-children {
    margin-left: 1rem;
    border-left: 1px solid #404040;
    padding-left: 0.5rem;
  }
</style>
