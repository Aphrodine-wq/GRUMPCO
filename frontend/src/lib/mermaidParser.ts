/**
 * Mermaid Parser Utilities
 * Extracts node information from Mermaid diagram code
 */

export interface ParsedNode {
  id: string;
  label: string;
  type?: string;
}

export interface NodeMap {
  [nodeId: string]: ParsedNode;
}

/**
 * Extract node IDs and labels from Mermaid flowchart/graph code
 */
export function parseMermaidNodes(code: string): NodeMap {
  const nodes: NodeMap = {};
  
  if (!code || !code.trim()) {
    return nodes;
  }

  // Remove diagram type declaration
  const content = code
    .replace(/^(flowchart|graph)\s+(?:TD|TB|BT|LR|RL|[\s\S]*?)\n/i, '')
    .trim();

  // Pattern 1: Node definitions with labels: A[Label] or A("Label") or A{Label}
  const nodeDefPattern = /(\w+)(?:\[([^\]]+)\]|\(([^)]+)\)|\{([^}]+)\})?/g;
  let match;
  
  while ((match = nodeDefPattern.exec(content)) !== null) {
    const nodeId = match[1];
    const label = match[2] || match[3] || match[4] || nodeId;
    
    if (!nodes[nodeId]) {
      nodes[nodeId] = {
        id: nodeId,
        label: label.trim(),
      };
    } else if (label && label !== nodeId) {
      // Update label if provided
      nodes[nodeId].label = label.trim();
    }
  }

  // Pattern 2: C4 diagram syntax
  // C4Context, C4Container, C4Component, etc.
  if (/C4/i.test(code)) {
    const c4Pattern = /(?:C4Context|C4Container|C4Component|C4Deployment|C4Dynamic)\s*\(\s*(\w+)\s*,\s*"([^"]+)"[^)]*\)/gi;
    while ((match = c4Pattern.exec(code)) !== null) {
      const nodeId = match[1];
      const label = match[2];
      
      if (!nodes[nodeId]) {
        nodes[nodeId] = {
          id: nodeId,
          label: label.trim(),
          type: 'c4',
        };
      }
    }
  }

  // Pattern 3: Extract from edges (nodes mentioned in connections)
  const edgePattern = /(\w+)\s*(?:-->|--|==>|==|-\.->|-\.-|==>|==)\s*(\w+)/g;
  while ((match = edgePattern.exec(content)) !== null) {
    const fromId = match[1];
    const toId = match[2];
    
    if (!nodes[fromId]) {
      nodes[fromId] = {
        id: fromId,
        label: fromId,
      };
    }
    
    if (!nodes[toId]) {
      nodes[toId] = {
        id: toId,
        label: toId,
      };
    }
  }

  return nodes;
}

/**
 * Find component in metadata by matching node ID or label
 */
export function findComponentByNodeId(
  nodeId: string,
  nodeLabel: string,
  components: Array<{ id: string; name: string }>
): { id: string; name: string } | null {
  if (!components || components.length === 0) {
    return null;
  }

  // Exact ID match (case-insensitive)
  const exactMatch = components.find(
    (c) => c.id.toLowerCase() === nodeId.toLowerCase()
  );
  if (exactMatch) {
    return exactMatch;
  }

  // Label/name match (case-insensitive, partial)
  const labelMatch = components.find((c) => {
    const nameLower = c.name.toLowerCase();
    const labelLower = nodeLabel.toLowerCase();
    return (
      nameLower === labelLower ||
      nameLower.includes(labelLower) ||
      labelLower.includes(nameLower)
    );
  });
  if (labelMatch) {
    return labelMatch;
  }

  // Partial ID match
  const partialMatch = components.find((c) => {
    const idLower = c.id.toLowerCase();
    return idLower.includes(nodeId.toLowerCase()) || nodeId.toLowerCase().includes(idLower);
  });
  if (partialMatch) {
    return partialMatch;
  }

  return null;
}

/**
 * Get SVG element that represents a Mermaid node
 * Mermaid typically uses classes like "node", "nodeLabel", and IDs based on node IDs
 */
export function findSvgNodeElement(svg: SVGElement, nodeId: string): SVGElement | null {
  if (!svg || !nodeId) {
    return null;
  }

  // Try multiple strategies to find the node
  // Strategy 1: Find by class containing nodeId
  const nodeClass = svg.querySelector(`.node-${nodeId}, [class*="${nodeId}"]`);
  if (nodeClass instanceof SVGElement) {
    return nodeClass;
  }

  // Strategy 2: Find by ID
  const nodeById = svg.querySelector(`#${nodeId}, #node-${nodeId}`);
  if (nodeById instanceof SVGElement) {
    return nodeById;
  }

  // Strategy 3: Find by text content (for labels)
  const allTextElements = svg.querySelectorAll('text');
  for (const textEl of Array.from(allTextElements)) {
    if (textEl.textContent?.trim().toLowerCase() === nodeId.toLowerCase()) {
      // Find parent group or node
      let parent = textEl.parentElement;
      while (parent && parent !== svg) {
        if (parent.classList.contains('node') || parent.tagName === 'g') {
          return parent as SVGElement;
        }
        parent = parent.parentElement;
      }
      return textEl as SVGElement;
    }
  }

  // Strategy 4: Find by data attributes (if Mermaid adds them)
  const nodeByData = svg.querySelector(`[data-node-id="${nodeId}"]`);
  if (nodeByData instanceof SVGElement) {
    return nodeByData;
  }

  return null;
}
