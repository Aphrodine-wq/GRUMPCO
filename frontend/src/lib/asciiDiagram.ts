/**
 * ASCII Diagram Renderer
 *
 * Converts Mermaid diagram syntax into ASCII art using Unicode box-drawing characters.
 * Supports flowchart/graph diagrams with TD (top-down) and LR (left-right) directions.
 *
 * For unsupported diagram types, falls back to a clean formatted text view.
 */

// ── Types ──────────────────────────────────────────────────────────────

interface ParsedNode {
  id: string;
  label: string;
  shape: 'rect' | 'round' | 'diamond' | 'circle' | 'stadium' | 'hex' | 'default';
}

interface ParsedEdge {
  from: string;
  to: string;
  label?: string;
  style: 'arrow' | 'thick' | 'dotted' | 'open';
}

interface ParsedDiagram {
  type: string;
  direction: 'TD' | 'TB' | 'LR' | 'RL' | 'BT';
  nodes: Map<string, ParsedNode>;
  edges: ParsedEdge[];
}

// ── Box Drawing Characters ─────────────────────────────────────────────

const BOX = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  arrowDown: '▼',
  arrowRight: '▶',
  arrowLeft: '◀',
  arrowUp: '▲',
  teeDown: '┬',
  teeUp: '┴',
  teeRight: '├',
  teeLeft: '┤',
  cross: '┼',
  dottedH: '╌',
  dottedV: '╎',
  thickH: '━',
  thickV: '┃',
  diamondTop: '◇',
  roundTopLeft: '╭',
  roundTopRight: '╮',
  roundBottomLeft: '╰',
  roundBottomRight: '╯',
};

// ── Parser ─────────────────────────────────────────────────────────────

function parseMermaidDiagram(code: string): ParsedDiagram | null {
  const lines = code
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return null;

  const firstLine = lines[0].toLowerCase();

  // Detect diagram type and direction
  let type = 'flowchart';
  let direction: ParsedDiagram['direction'] = 'TD';

  const flowchartMatch = firstLine.match(/^(flowchart|graph)\s+(td|tb|lr|rl|bt)/i);
  if (flowchartMatch) {
    type = 'flowchart';
    direction = flowchartMatch[2].toUpperCase() as ParsedDiagram['direction'];
  } else if (firstLine.startsWith('flowchart') || firstLine.startsWith('graph')) {
    type = 'flowchart';
  } else {
    // Unsupported types
    return null;
  }

  const nodes = new Map<string, ParsedNode>();
  const edges: ParsedEdge[] = [];

  // Process each line (skip the first line which is the declaration)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Skip comments and styling directives
    if (
      line.startsWith('%%') ||
      line.startsWith('style ') ||
      line.startsWith('classDef ') ||
      line.startsWith('class ') ||
      line.startsWith('click ') ||
      line.startsWith('linkStyle ') ||
      line.startsWith('subgraph') ||
      line === 'end' ||
      line.startsWith('direction ')
    ) {
      continue;
    }

    // Try to parse as edge (connection between nodes)
    const edgeParsed = parseEdgeLine(line, nodes);
    if (edgeParsed) {
      edges.push(...edgeParsed);
      continue;
    }

    // Try to parse as standalone node declaration
    const nodeParsed = parseStandaloneNode(line);
    if (nodeParsed && !nodes.has(nodeParsed.id)) {
      nodes.set(nodeParsed.id, nodeParsed);
    }
  }

  return { type, direction, nodes, edges };
}

function parseNodeDeclaration(raw: string): ParsedNode {
  const trimmed = raw.trim();

  // Check for various Mermaid node shapes
  // [label] = rect
  let match = trimmed.match(/^(\w[\w\d_-]*)\[([^\]]+)\]/);
  if (match) return { id: match[1], label: match[2].trim(), shape: 'rect' };

  // (label) = round
  match = trimmed.match(/^(\w[\w\d_-]*)\(([^)]+)\)/);
  if (match) return { id: match[1], label: match[2].trim(), shape: 'round' };

  // {label} = diamond
  match = trimmed.match(/^(\w[\w\d_-]*)\{([^}]+)\}/);
  if (match) return { id: match[1], label: match[2].trim(), shape: 'diamond' };

  // ((label)) = circle
  match = trimmed.match(/^(\w[\w\d_-]*)\(\(([^)]+)\)\)/);
  if (match) return { id: match[1], label: match[2].trim(), shape: 'circle' };

  // ([label]) = stadium
  match = trimmed.match(/^(\w[\w\d_-]*)\(\[([^\]]+)\]\)/);
  if (match) return { id: match[1], label: match[2].trim(), shape: 'stadium' };

  // {{label}} = hex
  match = trimmed.match(/^(\w[\w\d_-]*)\{\{([^}]+)\}\}/);
  if (match) return { id: match[1], label: match[2].trim(), shape: 'hex' };

  // >label] = asymmetric
  match = trimmed.match(/^(\w[\w\d_-]*)>([^\]]+)\]/);
  if (match) return { id: match[1], label: match[2].trim(), shape: 'rect' };

  // Simple node — just an ID
  const idMatch = trimmed.match(/^(\w[\w\d_-]*)/);
  if (idMatch) return { id: idMatch[1], label: idMatch[1], shape: 'default' };

  return { id: trimmed, label: trimmed, shape: 'default' };
}

function parseStandaloneNode(line: string): ParsedNode | null {
  const trimmed = line.trim();
  // Must have a shape declaration to be a standalone node
  if (/^\w[\w\d_-]*[[({<>]/.test(trimmed)) {
    return parseNodeDeclaration(trimmed);
  }
  return null;
}

function parseEdgeLine(line: string, nodes: Map<string, ParsedNode>): ParsedEdge[] | null {
  // Edge patterns: A --> B, A -->|label| B, A --- B, A -.-> B, A ==> B
  // Can also be chained: A --> B --> C
  const edgeRegex = /(-+->|=+=>|-.+->|-+(?!>)|--+>|~~>)/;

  if (!edgeRegex.test(line)) return null;

  const edges: ParsedEdge[] = [];

  // Split line by edge markers, preserving the markers
  // Try to find all segments: nodeA -->|label| nodeB --> nodeC
  const parts: string[] = [];
  const connectors: Array<{ style: ParsedEdge['style']; label?: string }> = [];

  // Match pattern: node (connector with optional label) node ...
  const segmentRegex =
    /\s*([\w\d_-]+(?:\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|\(\([^)]*\)\)|\(\[[^\]]*\]\))?)\s*/g;
  const connectorRegex = /\s*(--+>|=+=>|-\.+->|--+|~~>)\s*(?:\|([^|]*)\|)?\s*/g;

  // Split by connectors
  let remaining = line;
  let lastEnd = 0;
  const nodeSegments: string[] = [];
  const connSegments: Array<{ raw: string; label?: string }> = [];

  // Extract connectors with labels
  const connRegex2 = /(--+>|=+=>|-\.+->|--+|~~>|-->)(?:\|([^|]*)\|)?/g;
  let connMatch;
  const connPositions: Array<{ start: number; end: number; style: string; label?: string }> = [];

  while ((connMatch = connRegex2.exec(remaining)) !== null) {
    connPositions.push({
      start: connMatch.index,
      end: connMatch.index + connMatch[0].length,
      style: connMatch[1],
      label: connMatch[2],
    });
  }

  if (connPositions.length === 0) return null;

  // Extract nodes between connectors
  let pos = 0;
  for (const conn of connPositions) {
    const nodePart = remaining.slice(pos, conn.start).trim();
    if (nodePart) nodeSegments.push(nodePart);

    let edgeStyle: ParsedEdge['style'] = 'arrow';
    if (conn.style.includes('=>')) edgeStyle = 'thick';
    else if (conn.style.includes('-.')) edgeStyle = 'dotted';
    else if (!conn.style.includes('>')) edgeStyle = 'open';

    connSegments.push({ raw: conn.style, label: conn.label });
    pos = conn.end;
  }

  // Get the last node
  const lastPart = remaining.slice(pos).trim();
  if (lastPart) nodeSegments.push(lastPart);

  // Parse the nodes and create edges
  const parsedNodes: ParsedNode[] = nodeSegments.map((seg) => parseNodeDeclaration(seg));

  // Register all nodes
  for (const node of parsedNodes) {
    if (!nodes.has(node.id)) {
      nodes.set(node.id, node);
    } else {
      // Update label/shape if new declaration has them
      const existing = nodes.get(node.id)!;
      if (node.shape !== 'default') {
        existing.shape = node.shape;
        existing.label = node.label;
      }
    }
  }

  // Create edges
  for (let i = 0; i < connSegments.length; i++) {
    if (i < parsedNodes.length - 1) {
      let edgeStyle: ParsedEdge['style'] = 'arrow';
      const raw = connSegments[i].raw;
      if (raw.includes('=>')) edgeStyle = 'thick';
      else if (raw.includes('-.')) edgeStyle = 'dotted';
      else if (!raw.includes('>')) edgeStyle = 'open';

      edges.push({
        from: parsedNodes[i].id,
        to: parsedNodes[i + 1].id,
        label: connSegments[i].label,
        style: edgeStyle,
      });
    }
  }

  return edges.length > 0 ? edges : null;
}

// ── Layout ─────────────────────────────────────────────────────────────

interface LayoutNode {
  id: string;
  label: string;
  shape: ParsedNode['shape'];
  layer: number;
  position: number; // position within layer
  x: number; // column in the grid
  y: number; // row in the grid
  width: number;
  height: number;
}

function computeLayout(diagram: ParsedDiagram): {
  nodes: LayoutNode[];
  width: number;
  height: number;
} {
  const { nodes, edges, direction } = diagram;

  // Topological sort to determine layers
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const [id] of nodes) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }

  for (const edge of edges) {
    adjacency.get(edge.from)?.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
  }

  // BFS layers
  const layers: string[][] = [];
  const visited = new Set<string>();
  let queue = [...nodes.keys()].filter((id) => (inDegree.get(id) || 0) === 0);

  // If no roots found, just use all nodes
  if (queue.length === 0) {
    queue = [...nodes.keys()];
  }

  while (queue.length > 0) {
    const currentLayer: string[] = [];
    const nextQueue: string[] = [];

    for (const nodeId of queue) {
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      currentLayer.push(nodeId);

      const neighbors = adjacency.get(nodeId) || [];
      for (const neighbor of neighbors) {
        const newDeg = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg <= 0 && !visited.has(neighbor)) {
          nextQueue.push(neighbor);
        }
      }
    }

    if (currentLayer.length > 0) {
      layers.push(currentLayer);
    }
    queue = nextQueue;
  }

  // Add any remaining unvisited nodes
  const remaining = [...nodes.keys()].filter((id) => !visited.has(id));
  if (remaining.length > 0) {
    layers.push(remaining);
  }

  // Calculate node dimensions
  const PADDING = 2; // padding inside box
  const MIN_WIDTH = 12;
  const NODE_HEIGHT = 3; // top border + content + bottom border

  const layoutNodes: LayoutNode[] = [];
  const isHorizontal = direction === 'LR' || direction === 'RL';

  let maxLayerWidth = 0;
  for (const layer of layers) {
    maxLayerWidth = Math.max(maxLayerWidth, layer.length);
  }

  for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
    const layer = layers[layerIdx];
    for (let posIdx = 0; posIdx < layer.length; posIdx++) {
      const nodeId = layer[posIdx];
      const node = nodes.get(nodeId)!;
      const labelWidth = node.label.length + PADDING * 2;
      const width = Math.max(MIN_WIDTH, labelWidth + 2); // +2 for borders

      layoutNodes.push({
        id: node.id,
        label: node.label,
        shape: node.shape,
        layer: layerIdx,
        position: posIdx,
        x: 0, // Will be calculated
        y: 0, // Will be calculated
        width,
        height: NODE_HEIGHT,
      });
    }
  }

  return { nodes: layoutNodes, width: 0, height: 0 };
}

// ── ASCII Renderer ─────────────────────────────────────────────────────

function drawBox(label: string, shape: ParsedNode['shape'], width: number): string[] {
  const innerWidth = width - 2;
  const paddedLabel = label.length > innerWidth ? label.slice(0, innerWidth - 1) + '…' : label;
  const leftPad = Math.floor((innerWidth - paddedLabel.length) / 2);
  const rightPad = innerWidth - paddedLabel.length - leftPad;

  switch (shape) {
    case 'diamond': {
      // Diamond shape using proper diamond border
      const lines: string[] = [];
      const halfW = Math.floor(innerWidth / 2);
      lines.push(' '.repeat(halfW) + '◇' + ' '.repeat(halfW));
      lines.push(BOX.topLeft + BOX.horizontal.repeat(innerWidth) + BOX.topRight);
      lines.push(
        BOX.vertical + ' '.repeat(leftPad) + paddedLabel + ' '.repeat(rightPad) + BOX.vertical
      );
      lines.push(BOX.bottomLeft + BOX.horizontal.repeat(innerWidth) + BOX.bottomRight);
      lines.push(' '.repeat(halfW) + '◇' + ' '.repeat(halfW));
      return lines;
    }
    case 'round': {
      return [
        BOX.roundTopLeft + BOX.horizontal.repeat(innerWidth) + BOX.roundTopRight,
        BOX.vertical + ' '.repeat(leftPad) + paddedLabel + ' '.repeat(rightPad) + BOX.vertical,
        BOX.roundBottomLeft + BOX.horizontal.repeat(innerWidth) + BOX.roundBottomRight,
      ];
    }
    case 'circle': {
      return [
        BOX.roundTopLeft + BOX.horizontal.repeat(innerWidth) + BOX.roundTopRight,
        BOX.vertical + ' '.repeat(leftPad) + paddedLabel + ' '.repeat(rightPad) + BOX.vertical,
        BOX.roundBottomLeft + BOX.horizontal.repeat(innerWidth) + BOX.roundBottomRight,
      ];
    }
    case 'stadium': {
      return [
        '(' + BOX.horizontal.repeat(innerWidth) + ')',
        BOX.vertical + ' '.repeat(leftPad) + paddedLabel + ' '.repeat(rightPad) + BOX.vertical,
        '(' + BOX.horizontal.repeat(innerWidth) + ')',
      ];
    }
    case 'hex': {
      return [
        '/' + BOX.horizontal.repeat(innerWidth) + '\\',
        BOX.vertical + ' '.repeat(leftPad) + paddedLabel + ' '.repeat(rightPad) + BOX.vertical,
        '\\' + BOX.horizontal.repeat(innerWidth) + '/',
      ];
    }
    default: {
      // Default rect
      return [
        BOX.topLeft + BOX.horizontal.repeat(innerWidth) + BOX.topRight,
        BOX.vertical + ' '.repeat(leftPad) + paddedLabel + ' '.repeat(rightPad) + BOX.vertical,
        BOX.bottomLeft + BOX.horizontal.repeat(innerWidth) + BOX.bottomRight,
      ];
    }
  }
}

function renderVerticalDiagram(diagram: ParsedDiagram): string {
  const { nodes, edges } = diagram;

  // Topological layering
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const [id] of nodes) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }

  for (const edge of edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    if (!inDegree.has(edge.to)) inDegree.set(edge.to, 0);
    adjacency.get(edge.from)?.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
  }

  // BFS layers
  const layers: string[][] = [];
  const visited = new Set<string>();
  let queue = [...nodes.keys()].filter((id) => (inDegree.get(id) || 0) === 0);
  if (queue.length === 0) queue = [...nodes.keys()];

  while (queue.length > 0) {
    const currentLayer: string[] = [];
    const nextQueue: string[] = [];

    for (const nodeId of queue) {
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      currentLayer.push(nodeId);

      for (const neighbor of adjacency.get(nodeId) || []) {
        const newDeg = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg <= 0 && !visited.has(neighbor)) {
          nextQueue.push(neighbor);
        }
      }
    }

    if (currentLayer.length > 0) layers.push(currentLayer);
    queue = nextQueue;
  }

  // Add unvisited nodes
  const remaining = [...nodes.keys()].filter((id) => !visited.has(id));
  if (remaining.length > 0) layers.push(remaining);

  // Calculate max width per node ── IMPROVED for readability
  const PADDING_INNER = 3;
  const MIN_BOX_WIDTH = 20;
  const COLUMN_GAP = 6;

  const nodeWidths = new Map<string, number>();
  for (const [id, node] of nodes) {
    const w = Math.max(MIN_BOX_WIDTH, node.label.length + PADDING_INNER * 2 + 2);
    nodeWidths.set(id, w);
  }

  // Normalize widths within each layer so boxes on the same row are equal width
  const layerMaxWidths: number[] = [];
  for (const layer of layers) {
    let maxW = MIN_BOX_WIDTH;
    for (const id of layer) {
      maxW = Math.max(maxW, nodeWidths.get(id) || MIN_BOX_WIDTH);
    }
    layerMaxWidths.push(maxW);
    // Set all nodes in this layer to the same width for alignment
    for (const id of layer) {
      nodeWidths.set(id, maxW);
    }
  }

  // Build ASCII output
  const outputLines: string[] = [];

  for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
    const layer = layers[layerIdx];

    // Draw boxes for this layer
    const boxes = layer.map((id) => {
      const node = nodes.get(id)!;
      const width = nodeWidths.get(id) || MIN_BOX_WIDTH;
      return drawBox(node.label, node.shape, width);
    });

    // Find max box height
    const maxHeight = Math.max(...boxes.map((b) => b.length));

    // Render boxes side by side
    for (let row = 0; row < maxHeight; row++) {
      let line = '';
      for (let col = 0; col < boxes.length; col++) {
        const box = boxes[col];
        const width = nodeWidths.get(layer[col]) || MIN_BOX_WIDTH;
        if (row < box.length) {
          // Pad the box line to full width for alignment
          const boxLine = box[row];
          line += boxLine + ' '.repeat(Math.max(0, width - boxLine.length));
        } else {
          line += ' '.repeat(width);
        }
        if (col < boxes.length - 1) {
          line += ' '.repeat(COLUMN_GAP);
        }
      }
      outputLines.push(line);
    }

    // Draw connections to next layer
    if (layerIdx < layers.length - 1) {
      const nextLayer = layers[layerIdx + 1];

      // Find connections from this layer to the next
      const connections: Array<{
        fromIdx: number;
        toIdx: number;
        label?: string;
        style: ParsedEdge['style'];
      }> = [];

      for (const edge of edges) {
        const fromIdx = layer.indexOf(edge.from);
        const toIdx = nextLayer.indexOf(edge.to);
        if (fromIdx !== -1 && toIdx !== -1) {
          connections.push({
            fromIdx,
            toIdx,
            label: edge.label,
            style: edge.style,
          });
        }
      }

      // Calculate center positions for each node
      const getNodeCenter = (nodeId: string, layerArr: string[]) => {
        let x = 0;
        const idx = layerArr.indexOf(nodeId);
        for (let i = 0; i < idx; i++) {
          x += (nodeWidths.get(layerArr[i]) || MIN_BOX_WIDTH) + COLUMN_GAP;
        }
        x += Math.floor((nodeWidths.get(nodeId) || MIN_BOX_WIDTH) / 2);
        return x;
      };

      // Total width calculation
      const totalWidth = (arrLayer: string[]) => {
        let w = 0;
        for (let i = 0; i < arrLayer.length; i++) {
          w += nodeWidths.get(arrLayer[i]) || MIN_BOX_WIDTH;
          if (i < arrLayer.length - 1) w += COLUMN_GAP;
        }
        return w;
      };

      const currentTotalWidth = totalWidth(layer);
      const nextTotalWidth = totalWidth(nextLayer);
      const maxWidth = Math.max(currentTotalWidth, nextTotalWidth);

      if (connections.length > 0) {
        // Draw vertical lines down from source nodes — TALLER for readability
        const lineHeight = 3;

        // Check if any connections have labels
        const hasLabels = connections.some((c) => c.label);

        for (let h = 0; h < lineHeight; h++) {
          const chars = new Array(maxWidth + 4).fill(' ');

          for (const conn of connections) {
            const fromCenter = getNodeCenter(layer[conn.fromIdx], layer);
            const toCenter = getNodeCenter(nextLayer[conn.toIdx], nextLayer);
            // Use the source center for the first half, target center for the arrow
            const center = h < lineHeight - 1 ? fromCenter : fromCenter;
            if (center < chars.length) {
              chars[center] = conn.style === 'dotted' ? BOX.dottedV : BOX.vertical;
            }

            // Place label on the middle row of the connector
            if (h === 1 && conn.label && hasLabels) {
              const midX = Math.floor((fromCenter + toCenter) / 2);
              const labelStr = ` ${conn.label} `;
              const startX = Math.max(0, midX - Math.floor(labelStr.length / 2));
              // Only place label if it won't overlap with connector chars excessively
              for (let c = 0; c < labelStr.length; c++) {
                if (startX + c < chars.length && chars[startX + c] === ' ') {
                  chars[startX + c] = labelStr[c];
                }
              }
            }
          }

          outputLines.push(chars.join(''));
        }

        // Draw arrow heads pointing to next layer targets
        {
          const chars = new Array(maxWidth + 4).fill(' ');
          for (const conn of connections) {
            const toCenter = getNodeCenter(nextLayer[conn.toIdx], nextLayer);
            const fromCenter = getNodeCenter(layer[conn.fromIdx], layer);
            if (toCenter < chars.length) {
              chars[toCenter] = BOX.arrowDown;
            }
            // Draw horizontal routing if from and to centers differ
            if (fromCenter !== toCenter) {
              const minX = Math.min(fromCenter, toCenter);
              const maxX = Math.max(fromCenter, toCenter);
              for (let x = minX + 1; x < maxX; x++) {
                if (x < chars.length && chars[x] === ' ') {
                  chars[x] = conn.style === 'dotted' ? BOX.dottedH : BOX.horizontal;
                }
              }
            }
          }
          outputLines.push(chars.join(''));
        }
      } else {
        // No direct connections, just add spacing
        outputLines.push('');
        outputLines.push('');
      }
    }
  }

  return outputLines.map((l) => l.trimEnd()).join('\n');
}

function renderHorizontalDiagram(diagram: ParsedDiagram): string {
  const { nodes, edges } = diagram;

  // Topological layering
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const [id] of nodes) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }

  for (const edge of edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    if (!inDegree.has(edge.to)) inDegree.set(edge.to, 0);
    adjacency.get(edge.from)?.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
  }

  const layers: string[][] = [];
  const visited = new Set<string>();
  let queue = [...nodes.keys()].filter((id) => (inDegree.get(id) || 0) === 0);
  if (queue.length === 0) queue = [...nodes.keys()];

  while (queue.length > 0) {
    const currentLayer: string[] = [];
    const nextQueue: string[] = [];

    for (const nodeId of queue) {
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      currentLayer.push(nodeId);

      for (const neighbor of adjacency.get(nodeId) || []) {
        const newDeg = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg <= 0 && !visited.has(neighbor)) {
          nextQueue.push(neighbor);
        }
      }
    }

    if (currentLayer.length > 0) layers.push(currentLayer);
    queue = nextQueue;
  }

  const remaining = [...nodes.keys()].filter((id) => !visited.has(id));
  if (remaining.length > 0) layers.push(remaining);

  // For LR, each layer is a column, nodes stacked vertically ── IMPROVED
  const PADDING_INNER = 3;
  const MIN_BOX_WIDTH = 20;
  const ROW_GAP = 2;
  const ARROW_WIDTH = 7; // " ────▶ "

  const nodeWidths = new Map<string, number>();
  for (const [id, node] of nodes) {
    const w = Math.max(MIN_BOX_WIDTH, node.label.length + PADDING_INNER * 2 + 2);
    nodeWidths.set(id, w);
  }

  // Calculate max width per layer/column
  const layerWidths = layers.map((layer) =>
    Math.max(...layer.map((id) => nodeWidths.get(id) || MIN_BOX_WIDTH))
  );

  // Max nodes in any layer (determines total rows)
  const maxNodesInLayer = Math.max(...layers.map((l) => l.length));
  const BOX_HEIGHT = 3;

  // Build a 2D grid
  const totalRows = maxNodesInLayer * (BOX_HEIGHT + ROW_GAP) - ROW_GAP;
  const totalCols =
    layers.reduce((sum, _, i) => sum + layerWidths[i], 0) + (layers.length - 1) * ARROW_WIDTH;

  const grid: string[][] = [];
  for (let r = 0; r < totalRows; r++) {
    grid.push(new Array(totalCols).fill(' '));
  }

  // Place nodes and draw arrows
  let colOffset = 0;
  for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
    const layer = layers[layerIdx];
    const colWidth = layerWidths[layerIdx];

    for (let nodeIdx = 0; nodeIdx < layer.length; nodeIdx++) {
      const nodeId = layer[nodeIdx];
      const node = nodes.get(nodeId)!;
      const w = nodeWidths.get(nodeId) || MIN_BOX_WIDTH;
      const box = drawBox(node.label, node.shape, w);

      // Center the box in this row
      const rowStart = nodeIdx * (BOX_HEIGHT + ROW_GAP);
      const colStart = colOffset + Math.floor((colWidth - w) / 2);

      for (let r = 0; r < box.length && rowStart + r < totalRows; r++) {
        for (let c = 0; c < box[r].length && colStart + c < totalCols; c++) {
          grid[rowStart + r][colStart + c] = box[r][c];
        }
      }
    }

    // Draw arrows to next layer
    if (layerIdx < layers.length - 1) {
      const arrowStart = colOffset + colWidth;
      const nextLayer = layers[layerIdx + 1];

      for (const edge of edges) {
        const fromIdx = layer.indexOf(edge.from);
        const toIdx = nextLayer.indexOf(edge.to);

        if (fromIdx !== -1 && toIdx !== -1) {
          const fromRow = fromIdx * (BOX_HEIGHT + ROW_GAP) + Math.floor(BOX_HEIGHT / 2);
          const toRow = toIdx * (BOX_HEIGHT + ROW_GAP) + Math.floor(BOX_HEIGHT / 2);

          if (fromRow === toRow) {
            // Straight horizontal arrow
            const arrowChars =
              edge.style === 'dotted'
                ? BOX.dottedH.repeat(ARROW_WIDTH - 1) + BOX.arrowRight
                : edge.style === 'thick'
                  ? BOX.thickH.repeat(ARROW_WIDTH - 1) + BOX.arrowRight
                  : BOX.horizontal.repeat(ARROW_WIDTH - 1) + BOX.arrowRight;

            for (let c = 0; c < arrowChars.length && arrowStart + c < totalCols; c++) {
              grid[fromRow][arrowStart + c] = arrowChars[c];
            }
          } else {
            // Diagonal — draw horizontal out, vertical, horizontal in
            const midCol = arrowStart + Math.floor(ARROW_WIDTH / 2);

            // Horizontal from source
            for (let c = arrowStart; c < midCol && c < totalCols; c++) {
              grid[fromRow][c] = BOX.horizontal;
            }

            // Vertical
            const minRow = Math.min(fromRow, toRow);
            const maxRow = Math.max(fromRow, toRow);
            for (let r = minRow; r <= maxRow; r++) {
              if (midCol < totalCols) grid[r][midCol] = BOX.vertical;
            }

            // Horizontal to target + arrow
            for (let c = midCol + 1; c < arrowStart + ARROW_WIDTH - 1 && c < totalCols; c++) {
              grid[toRow][c] = BOX.horizontal;
            }
            if (arrowStart + ARROW_WIDTH - 1 < totalCols) {
              grid[toRow][arrowStart + ARROW_WIDTH - 1] = BOX.arrowRight;
            }
          }
        }
      }

      colOffset += colWidth + ARROW_WIDTH;
    } else {
      colOffset += colWidth;
    }
  }

  return grid.map((row) => row.join('').trimEnd()).join('\n');
}

// ── Sequence Diagram Renderer ──────────────────────────────────────────

interface SeqParticipant {
  id: string;
  label: string;
}

interface SeqMessage {
  from: string;
  to: string;
  label: string;
  type: 'solid' | 'dotted' | 'solidArrow' | 'dottedArrow';
}

function parseSequenceDiagram(
  code: string
): { participants: SeqParticipant[]; messages: SeqMessage[] } | null {
  const lines = code.trim().split('\n');
  const first = lines[0].trim();
  if (!/^sequenceDiagram/i.test(first)) return null;

  const participants: SeqParticipant[] = [];
  const participantIds = new Set<string>();
  const messages: SeqMessage[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('%%')) continue;

    // participant/actor declarations
    const partMatch = line.match(/^(?:participant|actor)\s+(\S+)(?:\s+as\s+(.+))?$/i);
    if (partMatch) {
      const id = partMatch[1];
      const label = partMatch[2] || id;
      if (!participantIds.has(id)) {
        participants.push({ id, label });
        participantIds.add(id);
      }
      continue;
    }

    // Message arrows: A ->> B: message
    const msgMatch = line.match(/^(\S+)\s*(--?>?>|--?>|->?>|->|-->>|-->|->>)\s*(\S+)\s*:\s*(.*)$/);
    if (msgMatch) {
      const from = msgMatch[1];
      const arrow = msgMatch[2];
      const to = msgMatch[3];
      const label = msgMatch[4].trim();

      // Auto-register participants
      if (!participantIds.has(from)) {
        participants.push({ id: from, label: from });
        participantIds.add(from);
      }
      if (!participantIds.has(to)) {
        participants.push({ id: to, label: to });
        participantIds.add(to);
      }

      let type: SeqMessage['type'] = 'solidArrow';
      if (arrow.includes('--') && arrow.includes('>>')) type = 'dottedArrow';
      else if (arrow.includes('--')) type = 'dotted';
      else if (arrow.includes('>>')) type = 'solidArrow';
      else type = 'solid';

      messages.push({ from, to, label, type });
    }
  }

  return participants.length > 0 ? { participants, messages } : null;
}

function renderSequenceDiagram(code: string): string | null {
  const parsed = parseSequenceDiagram(code);
  if (!parsed || parsed.participants.length === 0) return null;

  const { participants, messages } = parsed;
  const COL_WIDTH = 20;
  const colPositions = new Map<string, number>();

  participants.forEach((p, i) => {
    colPositions.set(p.id, i * COL_WIDTH + Math.floor(COL_WIDTH / 2));
  });

  const totalWidth = participants.length * COL_WIDTH;
  const output: string[] = [];

  // Draw participant boxes at top
  let headerTop = '';
  let headerMid = '';
  let headerBot = '';
  for (const p of participants) {
    const centered =
      p.label.length > COL_WIDTH - 4 ? p.label.slice(0, COL_WIDTH - 5) + '…' : p.label;
    const pad = COL_WIDTH - centered.length - 4;
    const lpad = Math.floor(pad / 2);
    const rpad = pad - lpad;
    headerTop += BOX.topLeft + BOX.horizontal.repeat(COL_WIDTH - 2) + BOX.topRight;
    headerMid +=
      BOX.vertical + ' '.repeat(lpad + 1) + centered + ' '.repeat(rpad + 1) + BOX.vertical;
    headerBot += BOX.bottomLeft + BOX.horizontal.repeat(COL_WIDTH - 2) + BOX.bottomRight;
  }
  output.push(headerTop);
  output.push(headerMid);
  output.push(headerBot);

  // Draw each message
  for (const msg of messages) {
    const fromCol = colPositions.get(msg.from) ?? 0;
    const toCol = colPositions.get(msg.to) ?? 0;
    const leftCol = Math.min(fromCol, toCol);
    const rightCol = Math.max(fromCol, toCol);
    const width = rightCol - leftCol;

    // Lifeline row
    let lifeline = '';
    for (let x = 0; x < totalWidth; x++) {
      let isLifeline = false;
      for (const [, col] of colPositions) {
        if (x === col) {
          isLifeline = true;
          break;
        }
      }
      lifeline += isLifeline ? '│' : ' ';
    }
    output.push(lifeline);

    // Arrow row
    let arrowRow = lifeline.split('');
    if (width > 0) {
      const isRight = fromCol < toCol;
      const arrowChar = msg.type.includes('dotted') ? '·' : '─';
      const headChar = isRight ? '▶' : '◀';

      for (let x = leftCol + 1; x < rightCol; x++) {
        arrowRow[x] = arrowChar;
      }
      arrowRow[isRight ? rightCol : leftCol] = headChar;

      // Place label above arrow if it fits
      const labelStr = msg.label.slice(0, width - 2);
      const labelStart = leftCol + Math.floor((width - labelStr.length) / 2);
      const labelRow = lifeline.split('');
      for (let c = 0; c < labelStr.length; c++) {
        if (labelStart + c >= 0 && labelStart + c < totalWidth) {
          labelRow[labelStart + c] = labelStr[c];
        }
      }
      output.push(labelRow.join(''));
    }
    output.push(arrowRow.join(''));
  }

  // Final lifeline
  let finalLine = '';
  for (let x = 0; x < totalWidth; x++) {
    let isLifeline = false;
    for (const [, col] of colPositions) {
      if (x === col) {
        isLifeline = true;
        break;
      }
    }
    finalLine += isLifeline ? '│' : ' ';
  }
  output.push(finalLine);

  return output.map((l) => l.trimEnd()).join('\n');
}

// ── Class Diagram Renderer ─────────────────────────────────────────────

interface ClassDef {
  name: string;
  properties: string[];
  methods: string[];
}

function parseClassDiagram(code: string): ClassDef[] | null {
  const lines = code.trim().split('\n');
  const first = lines[0].trim();
  if (!/^classDiagram/i.test(first)) return null;

  const classes = new Map<string, ClassDef>();
  let currentClass: string | null = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('%%')) continue;

    // class ClassName { ... }
    const classMatch = line.match(/^class\s+(\w+)\s*\{?\s*$/);
    if (classMatch) {
      const name = classMatch[1];
      if (!classes.has(name)) {
        classes.set(name, { name, properties: [], methods: [] });
      }
      currentClass = name;
      continue;
    }

    // End of class block
    if (line === '}') {
      currentClass = null;
      continue;
    }

    // Members when inside a class block
    if (currentClass && classes.has(currentClass)) {
      const cls = classes.get(currentClass)!;
      if (line.includes('(') && line.includes(')')) {
        cls.methods.push(line);
      } else {
        cls.properties.push(line);
      }
      continue;
    }

    // ClassName : member
    const memberMatch = line.match(/^(\w+)\s*:\s*(.+)$/);
    if (memberMatch) {
      const className = memberMatch[1];
      const member = memberMatch[2].trim();
      if (!classes.has(className)) {
        classes.set(className, { name: className, properties: [], methods: [] });
      }
      const cls = classes.get(className)!;
      if (member.includes('(') && member.includes(')')) {
        cls.methods.push(member);
      } else {
        cls.properties.push(member);
      }
      continue;
    }

    // Relationship: A --|> B
    const relMatch = line.match(
      /^(\w+)\s*(?:<\|--|--\|>|<\|\.\.|\.\.\|>|\*--|--\*|o--|--o|<--|-->|\.\.>|<\.\.)\s*(\w+)/
    );
    if (relMatch) {
      // Auto-register classes from relationships
      if (!classes.has(relMatch[1])) {
        classes.set(relMatch[1], { name: relMatch[1], properties: [], methods: [] });
      }
      if (!classes.has(relMatch[2])) {
        classes.set(relMatch[2], { name: relMatch[2], properties: [], methods: [] });
      }
    }
  }

  const result = [...classes.values()];
  return result.length > 0 ? result : null;
}

function renderClassDiagram(code: string): string | null {
  const classes = parseClassDiagram(code);
  if (!classes || classes.length === 0) return null;

  const output: string[] = [];

  for (const cls of classes) {
    const allMembers = [...cls.properties, ...cls.methods];
    const maxLen = Math.max(cls.name.length + 4, ...allMembers.map((m) => m.length + 4), 16);

    const divider = BOX.horizontal.repeat(maxLen);

    // Class name header
    const namePad = maxLen - cls.name.length - 2;
    const nameLpad = Math.floor(namePad / 2);
    const nameRpad = namePad - nameLpad;

    output.push(`${BOX.topLeft}${divider}${BOX.topRight}`);
    output.push(
      `${BOX.vertical} ${' '.repeat(nameLpad)}${cls.name}${' '.repeat(nameRpad)} ${BOX.vertical}`
    );

    // Properties section
    if (cls.properties.length > 0) {
      output.push(`${BOX.teeRight}${divider}${BOX.teeLeft}`);
      for (const prop of cls.properties) {
        const propPad = maxLen - prop.length - 2;
        output.push(`${BOX.vertical} ${prop}${' '.repeat(Math.max(0, propPad))} ${BOX.vertical}`);
      }
    }

    // Methods section
    if (cls.methods.length > 0) {
      output.push(`${BOX.teeRight}${divider}${BOX.teeLeft}`);
      for (const method of cls.methods) {
        const methodPad = maxLen - method.length - 2;
        output.push(
          `${BOX.vertical} ${method}${' '.repeat(Math.max(0, methodPad))} ${BOX.vertical}`
        );
      }
    }

    output.push(`${BOX.bottomLeft}${divider}${BOX.bottomRight}`);
    output.push(''); // Spacing between classes
  }

  return output.join('\n').trimEnd();
}

// ── State Diagram Renderer ─────────────────────────────────────────────

function parseStateDiagram(
  code: string
): { states: string[]; transitions: { from: string; to: string; label: string }[] } | null {
  const lines = code.trim().split('\n');
  const first = lines[0].trim();
  if (!/^stateDiagram/i.test(first)) return null;

  const stateSet = new Set<string>();
  const transitions: { from: string; to: string; label: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('%%')) continue;

    // Transition: StateA --> StateB : label
    const transMatch = line.match(/^(\S+)\s*-->\s*(\S+)(?:\s*:\s*(.+))?$/);
    if (transMatch) {
      const from = transMatch[1] === '[*]' ? '●' : transMatch[1];
      const to = transMatch[2] === '[*]' ? '●' : transMatch[2];
      const label = transMatch[3]?.trim() || '';
      stateSet.add(from);
      stateSet.add(to);
      transitions.push({ from, to, label });
      continue;
    }

    // State declaration
    const stateMatch = line.match(/^state\s+"?([^"]+)"?\s+as\s+(\w+)$/);
    if (stateMatch) {
      stateSet.add(stateMatch[2]);
    }
  }

  const states = [...stateSet];
  return states.length > 0 ? { states, transitions } : null;
}

function renderStateDiagram(code: string): string | null {
  const parsed = parseStateDiagram(code);
  if (!parsed) return null;

  const { states, transitions } = parsed;
  const output: string[] = [];

  // Draw states vertically with transitions
  const maxStateLen = Math.max(...states.map((s) => s.length), 8);
  const boxWidth = maxStateLen + 4;

  for (let i = 0; i < states.length; i++) {
    const state = states[i];

    if (state === '●') {
      // Special start/end marker
      output.push('  ● ');
    } else {
      const pad = boxWidth - state.length - 2;
      const lpad = Math.floor(pad / 2);
      const rpad = pad - lpad;
      output.push(`${BOX.roundTopLeft}${BOX.horizontal.repeat(boxWidth)}${BOX.roundTopRight}`);
      output.push(`${BOX.vertical} ${' '.repeat(lpad)}${state}${' '.repeat(rpad)} ${BOX.vertical}`);
      output.push(
        `${BOX.roundBottomLeft}${BOX.horizontal.repeat(boxWidth)}${BOX.roundBottomRight}`
      );
    }

    // Find transitions from this state
    const outgoing = transitions.filter((t) => t.from === state);
    if (outgoing.length > 0 && i < states.length - 1) {
      const center = Math.floor(boxWidth / 2) + 1;
      const label = outgoing[0].label;
      if (label) {
        output.push(`${' '.repeat(center)}│ ${label}`);
      } else {
        output.push(`${' '.repeat(center)}│`);
      }
      output.push(`${' '.repeat(center)}▼`);
    }
  }

  return output.join('\n');
}

// ── ER Diagram Renderer ────────────────────────────────────────────────

interface EREntity {
  name: string;
  attributes: string[];
}

interface ERRelation {
  from: string;
  to: string;
  label: string;
  fromCardinality: string;
  toCardinality: string;
}

function parseERDiagram(code: string): { entities: EREntity[]; relations: ERRelation[] } | null {
  const lines = code.trim().split('\n');
  const first = lines[0].trim();
  if (!/^erDiagram/i.test(first)) return null;

  const entityMap = new Map<string, EREntity>();
  const relations: ERRelation[] = [];
  let currentEntity: string | null = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('%%')) continue;

    // Relationship: CUSTOMER ||--o{ ORDER : places
    const relMatch = line.match(
      /^(\w+)\s+(\|{1,2}|}{1,2}|o)(-{1,2})(o|\|{1,2}|}{1,2}|\{)\s+(\w+)\s*:\s*(.+)$/
    );
    if (relMatch) {
      const from = relMatch[1];
      const to = relMatch[5];
      const label = relMatch[6].trim();
      if (!entityMap.has(from)) entityMap.set(from, { name: from, attributes: [] });
      if (!entityMap.has(to)) entityMap.set(to, { name: to, attributes: [] });
      relations.push({
        from,
        to,
        label,
        fromCardinality: relMatch[2],
        toCardinality: relMatch[4],
      });
      continue;
    }

    // Entity block start
    const entityMatch = line.match(/^(\w+)\s*\{/);
    if (entityMatch) {
      currentEntity = entityMatch[1];
      if (!entityMap.has(currentEntity)) {
        entityMap.set(currentEntity, { name: currentEntity, attributes: [] });
      }
      continue;
    }

    // End of entity block
    if (line === '}') {
      currentEntity = null;
      continue;
    }

    // Attribute inside entity: type name
    if (currentEntity && entityMap.has(currentEntity)) {
      entityMap.get(currentEntity)!.attributes.push(line);
    }
  }

  const entities = [...entityMap.values()];
  return entities.length > 0 ? { entities, relations } : null;
}

function renderERDiagram(code: string): string | null {
  const parsed = parseERDiagram(code);
  if (!parsed) return null;

  const { entities, relations } = parsed;
  const output: string[] = [];

  // Draw entities as boxes
  for (const entity of entities) {
    const allLines = [entity.name, ...entity.attributes];
    const maxLen = Math.max(...allLines.map((l) => l.length), 10) + 4;
    const divider = BOX.horizontal.repeat(maxLen);

    const namePad = maxLen - entity.name.length - 2;
    const nlpad = Math.floor(namePad / 2);
    const nrpad = namePad - nlpad;

    output.push(`${BOX.topLeft}${divider}${BOX.topRight}`);
    output.push(
      `${BOX.vertical} ${' '.repeat(nlpad)}${entity.name}${' '.repeat(nrpad)} ${BOX.vertical}`
    );

    if (entity.attributes.length > 0) {
      output.push(`${BOX.teeRight}${divider}${BOX.teeLeft}`);
      for (const attr of entity.attributes) {
        const attrPad = maxLen - attr.length - 2;
        output.push(`${BOX.vertical} ${attr}${' '.repeat(Math.max(0, attrPad))} ${BOX.vertical}`);
      }
    }
    output.push(`${BOX.bottomLeft}${divider}${BOX.bottomRight}`);
    output.push('');
  }

  // Show relationships
  if (relations.length > 0) {
    output.push(`${BOX.horizontal.repeat(30)}`);
    output.push('Relationships:');
    for (const rel of relations) {
      output.push(
        `  ${rel.from} ${rel.fromCardinality}──${rel.toCardinality} ${rel.to} : ${rel.label}`
      );
    }
  }

  return output.join('\n').trimEnd();
}

// ── Gantt Chart Renderer ───────────────────────────────────────────────

interface GanttTask {
  name: string;
  status: string;
  start: string;
  duration: string;
}

function parseGanttChart(
  code: string
): { title: string; sections: { name: string; tasks: GanttTask[] }[] } | null {
  const lines = code.trim().split('\n');
  const first = lines[0].trim();
  if (!/^gantt/i.test(first)) return null;

  let title = 'Gantt Chart';
  const sections: { name: string; tasks: GanttTask[] }[] = [];
  let currentSection: { name: string; tasks: GanttTask[] } = { name: 'Tasks', tasks: [] };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('%%')) continue;

    // title
    const titleMatch = line.match(/^title\s+(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1];
      continue;
    }

    // dateFormat, axisFormat, etc - skip
    if (/^(dateFormat|axisFormat|tickInterval|todayMarker|excludes)/i.test(line)) continue;

    // section
    const sectionMatch = line.match(/^section\s+(.+)$/i);
    if (sectionMatch) {
      if (currentSection.tasks.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { name: sectionMatch[1], tasks: [] };
      continue;
    }

    // task: Task Name :status, id, start, duration
    const taskMatch = line.match(/^(.+?)\s*:(.+)$/);
    if (taskMatch) {
      const name = taskMatch[1].trim();
      const parts = taskMatch[2].split(',').map((s) => s.trim());
      currentSection.tasks.push({
        name,
        status: parts[0] || '',
        start: parts.length > 2 ? parts[2] : parts[1] || '',
        duration: parts[parts.length - 1] || '',
      });
    }
  }

  if (currentSection.tasks.length > 0) {
    sections.push(currentSection);
  }

  return sections.length > 0 ? { title, sections } : null;
}

function renderGanttChart(code: string): string | null {
  const parsed = parseGanttChart(code);
  if (!parsed) return null;

  const { title, sections } = parsed;
  const output: string[] = [];

  // All tasks flattened for width calculation
  const allTasks = sections.flatMap((s) => s.tasks);
  const maxNameLen = Math.max(
    title.length,
    ...sections.map((s) => s.name.length),
    ...allTasks.map((t) => t.name.length),
    12
  );

  const BAR_WIDTH = 30;
  const totalWidth = maxNameLen + 4 + BAR_WIDTH + 4;
  const divider = BOX.horizontal.repeat(totalWidth);

  // Title
  const titlePad = totalWidth - title.length - 2;
  const tlpad = Math.floor(titlePad / 2);
  const trpad = titlePad - tlpad;

  output.push(`${BOX.topLeft}${divider}${BOX.topRight}`);
  output.push(`${BOX.vertical} ${' '.repeat(tlpad)}${title}${' '.repeat(trpad)} ${BOX.vertical}`);
  output.push(`${BOX.teeRight}${divider}${BOX.teeLeft}`);

  let taskIndex = 0;
  for (const section of sections) {
    // Section header
    const secPad = totalWidth - section.name.length - 4;
    output.push(
      `${BOX.vertical}  ${section.name}${' '.repeat(Math.max(0, secPad))}  ${BOX.vertical}`
    );
    output.push(`${BOX.vertical}${' '.repeat(totalWidth)}${BOX.vertical}`);

    for (const task of section.tasks) {
      const namePart = task.name + ' '.repeat(Math.max(0, maxNameLen - task.name.length));
      // Create a simple bar visualization
      const barLen = Math.min(BAR_WIDTH - 2, Math.max(3, Math.floor(BAR_WIDTH * 0.6)));
      const barOffset = Math.floor(((taskIndex % 3) * (BAR_WIDTH - barLen)) / 3);
      const isDone = task.status.includes('done');
      const isActive = task.status.includes('active');
      const barChar = isDone ? '█' : isActive ? '▓' : '░';

      let bar =
        ' '.repeat(barOffset) +
        barChar.repeat(barLen) +
        ' '.repeat(Math.max(0, BAR_WIDTH - barOffset - barLen));

      const rowPad = totalWidth - namePart.length - bar.length - 6;
      output.push(
        `${BOX.vertical}  ${namePart}  ${bar}${' '.repeat(Math.max(0, rowPad))}  ${BOX.vertical}`
      );
      taskIndex++;
    }
    output.push(`${BOX.vertical}${' '.repeat(totalWidth)}${BOX.vertical}`);
  }

  output.push(`${BOX.bottomLeft}${divider}${BOX.bottomRight}`);

  return output.join('\n');
}

// ── Pie Chart Renderer ─────────────────────────────────────────────────

function parsePieChart(
  code: string
): { title: string; slices: { label: string; value: number }[] } | null {
  const lines = code.trim().split('\n');
  const first = lines[0].trim();
  if (!/^pie/i.test(first)) return null;

  let title = 'Pie Chart';
  const slices: { label: string; value: number }[] = [];

  // Check if title is on first line: pie title My Title
  const titleOnFirst = first.match(/^pie\s+title\s+(.+)$/i);
  if (titleOnFirst) {
    title = titleOnFirst[1];
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('%%')) continue;

    // title directive
    const titleMatch = line.match(/^title\s+(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1];
      continue;
    }

    // Slice: "Label" : value
    const sliceMatch = line.match(/^"([^"]+)"\s*:\s*(\d+(?:\.\d+)?)$/);
    if (sliceMatch) {
      slices.push({
        label: sliceMatch[1],
        value: parseFloat(sliceMatch[2]),
      });
    }
  }

  return slices.length > 0 ? { title, slices } : null;
}

function renderPieChart(code: string): string | null {
  const parsed = parsePieChart(code);
  if (!parsed || parsed.slices.length === 0) return null;

  const { title, slices } = parsed;
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) return null;

  const output: string[] = [];

  const BAR_MAX = 30;
  const maxLabelLen = Math.max(title.length, ...slices.map((s) => s.label.length), 10);
  const totalWidth = maxLabelLen + BAR_MAX + 16;
  const divider = BOX.horizontal.repeat(totalWidth);

  // Title
  const titlePad = totalWidth - title.length - 2;
  const tlpad = Math.floor(titlePad / 2);
  const trpad = titlePad - tlpad;

  output.push(`${BOX.topLeft}${divider}${BOX.topRight}`);
  output.push(`${BOX.vertical} ${' '.repeat(tlpad)}${title}${' '.repeat(trpad)} ${BOX.vertical}`);
  output.push(`${BOX.teeRight}${divider}${BOX.teeLeft}`);

  const pieChars = ['█', '▓', '░', '▒', '▐', '▌', '▄', '▀'];

  for (let i = 0; i < slices.length; i++) {
    const slice = slices[i];
    const pct = (slice.value / total) * 100;
    const barLen = Math.max(1, Math.round((slice.value / total) * BAR_MAX));
    const barChar = pieChars[i % pieChars.length];
    const bar = barChar.repeat(barLen);
    const pctStr = pct.toFixed(1) + '%';

    const labelPad = maxLabelLen - slice.label.length;
    const barPad = BAR_MAX - barLen;
    const rowContent = `  ${slice.label}${' '.repeat(labelPad)}  ${bar}${' '.repeat(barPad)}  ${pctStr}`;
    const rowPad = totalWidth - rowContent.length;
    output.push(`${BOX.vertical}${rowContent}${' '.repeat(Math.max(0, rowPad))}${BOX.vertical}`);
  }

  // Total row
  output.push(`${BOX.teeRight}${divider}${BOX.teeLeft}`);
  const totalStr = `  Total: ${total}`;
  const totalPad = totalWidth - totalStr.length;
  output.push(`${BOX.vertical}${totalStr}${' '.repeat(Math.max(0, totalPad))}${BOX.vertical}`);
  output.push(`${BOX.bottomLeft}${divider}${BOX.bottomRight}`);

  return output.join('\n');
}

// ── Format Unsupported ─────────────────────────────────────────────────

/**
 * Format unsupported diagram types as a clean text display.
 * Adds a title header and preserves the original Mermaid code.
 */
function formatUnsupportedDiagram(code: string): string {
  const lines = code.trim().split('\n');
  const firstLine = lines[0].trim();

  // Detect type for title
  let title = 'Diagram';
  if (firstLine.match(/^sequenceDiagram/i)) title = 'Sequence Diagram';
  else if (firstLine.match(/^classDiagram/i)) title = 'Class Diagram';
  else if (firstLine.match(/^erDiagram/i)) title = 'ER Diagram';
  else if (firstLine.match(/^stateDiagram/i)) title = 'State Diagram';
  else if (firstLine.match(/^gantt/i)) title = 'Gantt Chart';
  else if (firstLine.match(/^pie/i)) title = 'Pie Chart';
  else if (firstLine.match(/^gitgraph/i)) title = 'Git Graph';
  else if (firstLine.match(/^journey/i)) title = 'User Journey';
  else if (firstLine.match(/^mindmap/i)) title = 'Mind Map';
  else if (firstLine.match(/^timeline/i)) title = 'Timeline';
  else if (firstLine.match(/^(flowchart|graph)/i)) title = 'Flowchart';

  const maxLen = Math.max(title.length + 4, ...lines.map((l) => l.length + 4));
  const divider = BOX.horizontal.repeat(maxLen);

  const output: string[] = [];
  output.push(`${BOX.topLeft}${divider}${BOX.topRight}`);
  output.push(`${BOX.vertical}  ${title}${' '.repeat(maxLen - title.length - 2)}${BOX.vertical}`);
  output.push(`${BOX.teeRight}${divider}${BOX.teeLeft}`);

  for (const line of lines.slice(1)) {
    const padded = `  ${line}${' '.repeat(Math.max(0, maxLen - line.length - 2))}`;
    output.push(`${BOX.vertical}${padded}${BOX.vertical}`);
  }

  output.push(`${BOX.bottomLeft}${divider}${BOX.bottomRight}`);

  return output.join('\n');
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Supported diagram types for ASCII rendering.
 */
const SUPPORTED_TYPES = [
  'flowchart',
  'graph',
  'sequenceDiagram',
  'classDiagram',
  'stateDiagram',
  'erDiagram',
  'gantt',
  'pie',
];

/**
 * Convert Mermaid code to ASCII art diagram.
 * Supports flowcharts, sequence, class, state, ER, Gantt, and pie diagrams.
 * Returns the ASCII art string.
 */
export function mermaidToAscii(code: string): string {
  if (!code || code.trim().length === 0) {
    return '';
  }

  const firstLine = code.trim().split('\n')[0].trim().toLowerCase();

  try {
    // Route to the appropriate renderer based on diagram type
    if (/^sequencediagram/i.test(firstLine)) {
      const result = renderSequenceDiagram(code);
      if (result) return result;
    }
    if (/^classdiagram/i.test(firstLine)) {
      const result = renderClassDiagram(code);
      if (result) return result;
    }
    if (/^statediagram/i.test(firstLine)) {
      const result = renderStateDiagram(code);
      if (result) return result;
    }
    if (/^erdiagram/i.test(firstLine)) {
      const result = renderERDiagram(code);
      if (result) return result;
    }
    if (/^gantt/i.test(firstLine)) {
      const result = renderGanttChart(code);
      if (result) return result;
    }
    if (/^pie/i.test(firstLine)) {
      const result = renderPieChart(code);
      if (result) return result;
    }

    // Flowchart / graph (existing logic)
    const diagram = parseMermaidDiagram(code);

    if (!diagram) {
      return formatUnsupportedDiagram(code);
    }

    if (diagram.nodes.size === 0) {
      return formatUnsupportedDiagram(code);
    }

    const isHorizontal = diagram.direction === 'LR' || diagram.direction === 'RL';

    if (isHorizontal) {
      return renderHorizontalDiagram(diagram);
    } else {
      return renderVerticalDiagram(diagram);
    }
  } catch (err) {
    console.warn('ASCII diagram rendering failed, falling back to formatted view:', err);
    return formatUnsupportedDiagram(code);
  }
}

/**
 * Check if the given Mermaid code can be rendered as ASCII.
 * Now supports multiple diagram types.
 */
export function canRenderAsAscii(code: string): boolean {
  if (!code) return false;
  const firstLine = code.trim().split('\n')[0].trim();
  // Flowchart/graph
  if (/^(flowchart|graph)\s+(td|tb|lr|rl|bt)/i.test(firstLine)) return true;
  // Other supported types
  if (/^(sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie)/i.test(firstLine))
    return true;
  return false;
}
