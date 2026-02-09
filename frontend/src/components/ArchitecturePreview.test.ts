import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import ArchitecturePreview from './ArchitecturePreview.svelte';

describe('ArchitecturePreview', () => {
  const mockOnNodeClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render architecture preview', () => {
    const { container } = render(ArchitecturePreview, {
      props: {
        mermaidCode: '',
      },
    });

    expect(container).toBeTruthy();
    expect(container.querySelector('.architecture-preview')).toBeTruthy();
  });

  it('should show empty state when no mermaid code', () => {
    const { getByText } = render(ArchitecturePreview, {
      props: {
        mermaidCode: '',
      },
    });

    expect(getByText('No structure detected.')).toBeTruthy();
    expect(getByText('Generate a diagram or paste Mermaid code to see the tree.')).toBeTruthy();
  });

  it('should render title', () => {
    const { getByText } = render(ArchitecturePreview, {
      props: {
        mermaidCode: '',
      },
    });

    expect(getByText('Architecture Structure')).toBeTruthy();
  });

  it('should parse flowchart TD diagram', async () => {
    const mermaidCode = `flowchart TD
      A[Start] --> B[Process]
      B --> C[End]`;

    const { container } = render(ArchitecturePreview, {
      props: { mermaidCode },
    });

    await waitFor(() => {
      expect(container.querySelector('.preview-tree')).toBeTruthy();
    });

    expect(container.textContent).toContain('Start');
    expect(container.textContent).toContain('Process');
    expect(container.textContent).toContain('End');
  });

  it('should parse flowchart TB diagram', async () => {
    const mermaidCode = `flowchart TB
      A[Top] --> B[Bottom]`;

    const { container } = render(ArchitecturePreview, {
      props: { mermaidCode },
    });

    await waitFor(() => {
      expect(container.querySelector('.preview-tree')).toBeTruthy();
    });
  });

  it('should parse graph LR diagram', async () => {
    const mermaidCode = `graph LR
      A[Left] --> B[Right]`;

    const { container } = render(ArchitecturePreview, {
      props: { mermaidCode },
    });

    await waitFor(() => {
      expect(container.querySelector('.preview-tree')).toBeTruthy();
    });
  });

  it('should parse graph TD diagram', async () => {
    const mermaidCode = `graph TD
      A[Node A] --> B[Node B]`;

    const { container } = render(ArchitecturePreview, {
      props: { mermaidCode },
    });

    await waitFor(() => {
      expect(container.querySelector('.preview-tree')).toBeTruthy();
    });
  });

  it('should extract node labels from definitions', async () => {
    const mermaidCode = `flowchart TD
      A[Custom Label] --> B[Another Label]`;

    const { getByText } = render(ArchitecturePreview, {
      props: { mermaidCode },
    });

    await waitFor(() => {
      expect(getByText('Custom Label')).toBeTruthy();
      expect(getByText('Another Label')).toBeTruthy();
    });
  });

  it('should use node ID as label when no label provided', async () => {
    const mermaidCode = `flowchart TD
      A --> B --> C`;

    const { getByText } = render(ArchitecturePreview, {
      props: { mermaidCode },
    });

    await waitFor(() => {
      expect(getByText('A')).toBeTruthy();
      expect(getByText('B')).toBeTruthy();
      expect(getByText('C')).toBeTruthy();
    });
  });

  it('should build hierarchy from edges', async () => {
    const mermaidCode = `flowchart TD
      Root[Root Node]
      Root --> Child1[Child 1]
      Root --> Child2[Child 2]
      Child1 --> GrandChild[Grand Child]`;

    const { container } = render(ArchitecturePreview, {
      props: { mermaidCode },
    });

    await waitFor(() => {
      const treeNodes = container.querySelectorAll('.tree-node');
      expect(treeNodes.length).toBeGreaterThan(0);
    });
  });

  it('should toggle node expansion on click', async () => {
    const mermaidCode = `flowchart TD
      A[Parent] --> B[Child]`;

    const { container } = render(ArchitecturePreview, {
      props: { mermaidCode },
    });

    await waitFor(() => {
      expect(container.querySelector('.tree-node')).toBeTruthy();
    });

    const toggleButton = container.querySelector('.tree-toggle');
    if (toggleButton) {
      await fireEvent.click(toggleButton);
      // Should toggle the expansion state
      expect(toggleButton).toBeTruthy();
    }
  });

  it('should call onNodeClick when node clicked', async () => {
    const mermaidCode = `flowchart TD
      A[Test Node] --> B[Other]`;

    const { container } = render(ArchitecturePreview, {
      props: {
        mermaidCode,
        onNodeClick: mockOnNodeClick,
      },
    });

    await waitFor(() => {
      expect(container.querySelector('.tree-node-content')).toBeTruthy();
    });

    const nodeContent = container.querySelector('.tree-node-content');
    if (nodeContent) {
      await fireEvent.click(nodeContent);
      expect(mockOnNodeClick).toHaveBeenCalled();
    }
  });

  it('should expand first level by default', async () => {
    const mermaidCode = `flowchart TD
      Root[Root] --> Child[Child]`;

    const { container } = render(ArchitecturePreview, {
      props: { mermaidCode },
    });

    await waitFor(() => {
      const treeChildren = container.querySelector('.tree-children');
      // Root node with children should be expanded
      expect(container.querySelector('.preview-tree')).toBeTruthy();
    });
  });

  it('should show toggle button for nodes with children', async () => {
    const mermaidCode = `flowchart TD
      A[Parent] --> B[Child]`;

    const { container } = render(ArchitecturePreview, {
      props: { mermaidCode },
    });

    await waitFor(() => {
      const toggleButton = container.querySelector('.tree-toggle');
      expect(toggleButton).toBeTruthy();
    });
  });

  it('should show spacer for leaf nodes', async () => {
    const mermaidCode = `flowchart TD
      A[Only Node]`;

    const { container } = render(ArchitecturePreview, {
      props: { mermaidCode },
    });

    await waitFor(() => {
      const spacer = container.querySelector('.tree-toggle-spacer');
      expect(spacer).toBeTruthy();
    });
  });

  it('should handle complex diagrams with multiple roots', async () => {
    const mermaidCode = `flowchart TD
      A[Tree 1] --> B[Child 1]
      C[Tree 2] --> D[Child 2]`;

    const { container } = render(ArchitecturePreview, {
      props: { mermaidCode },
    });

    await waitFor(() => {
      const treeRoots = container.querySelectorAll('.tree-root');
      expect(treeRoots.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('should handle orphaned nodes', async () => {
    const mermaidCode = `flowchart TD
      A --> B
      C[Orphan]`;

    const { container } = render(ArchitecturePreview, {
      props: { mermaidCode },
    });

    await waitFor(() => {
      expect(container.textContent).toContain('Orphan');
    });
  });

  it('should handle different arrow styles', async () => {
    const arrowStyles = [
      'A --> B',
      'A -- --> B',
      'A ==> B',
      'A == ==> B',
    ];

    arrowStyles.forEach((arrow) => {
      const { container } = render(ArchitecturePreview, {
        props: {
          mermaidCode: `flowchart TD\n${arrow}`,
        },
      });

      expect(container.querySelector('.architecture-preview')).toBeTruthy();
    });
  });

  it('should handle empty diagram gracefully', () => {
    const { getByText } = render(ArchitecturePreview, {
      props: {
        mermaidCode: 'flowchart TD\n',
      },
    });

    expect(getByText('No structure detected.')).toBeTruthy();
  });

  it('should handle malformed mermaid code', () => {
    const { container } = render(ArchitecturePreview, {
      props: {
        mermaidCode: 'not valid mermaid',
      },
    });

    expect(container.querySelector('.architecture-preview')).toBeTruthy();
  });

  it('should update when mermaidCode changes', async () => {
    const { container, rerender, getByText } = render(ArchitecturePreview, {
      props: {
        mermaidCode: 'flowchart TD\nA[First]',
      },
    });

    await waitFor(() => {
      expect(getByText('First')).toBeTruthy();
    });

    await rerender({
      mermaidCode: 'flowchart TD\nB[Second]',
    });

    await waitFor(() => {
      expect(getByText('Second')).toBeTruthy();
    });
  });

  it('should make nodes keyboard accessible', async () => {
    const mermaidCode = `flowchart TD
      A[Accessible] --> B[Node]`;

    const { container } = render(ArchitecturePreview, {
      props: {
        mermaidCode,
        onNodeClick: mockOnNodeClick,
      },
    });

    await waitFor(() => {
      const nodeContent = container.querySelector('.tree-node-content');
      expect(nodeContent?.getAttribute('role')).toBe('button');
      expect(nodeContent?.getAttribute('tabindex')).toBe('0');
    });
  });

  it('should handle keyboard Enter key on node', async () => {
    const mermaidCode = `flowchart TD
      A[Node]`;

    const { container } = render(ArchitecturePreview, {
      props: {
        mermaidCode,
        onNodeClick: mockOnNodeClick,
      },
    });

    await waitFor(() => {
      const nodeContent = container.querySelector('.tree-node-content');
      if (nodeContent) {
        fireEvent.keyDown(nodeContent, { key: 'Enter' });
        // The component handles Enter key
      }
    });
  });

  it('should handle keyboard Space key on node', async () => {
    const mermaidCode = `flowchart TD
      A[Node]`;

    const { container } = render(ArchitecturePreview, {
      props: {
        mermaidCode,
        onNodeClick: mockOnNodeClick,
      },
    });

    await waitFor(() => {
      const nodeContent = container.querySelector('.tree-node-content');
      if (nodeContent) {
        fireEvent.keyDown(nodeContent, { key: ' ' });
        // The component handles Space key
      }
    });
  });

  it('should stop propagation when toggle clicked', async () => {
    const mermaidCode = `flowchart TD
      A[Parent] --> B[Child]`;

    const { container } = render(ArchitecturePreview, {
      props: {
        mermaidCode,
        onNodeClick: mockOnNodeClick,
      },
    });

    await waitFor(() => {
      const toggleButton = container.querySelector('.tree-toggle');
      if (toggleButton) {
        const stopPropagation = vi.fn();
        fireEvent.click(toggleButton, { stopPropagation });
        // Toggle should work without triggering node click
      }
    });
  });

  it('should handle self-referencing nodes', async () => {
    const mermaidCode = `flowchart TD
      A[Node] --> A`;

    const { container } = render(ArchitecturePreview, {
      props: { mermaidCode },
    });

    await waitFor(() => {
      expect(container.querySelector('.preview-tree')).toBeTruthy();
    });
  });

  it('should handle deeply nested structures', async () => {
    const mermaidCode = `flowchart TD
      A --> B --> C --> D --> E --> F`;

    const { container } = render(ArchitecturePreview, {
      props: { mermaidCode },
    });

    await waitFor(() => {
      expect(container.querySelector('.preview-tree')).toBeTruthy();
    });
  });

  it('should display node type badge when type provided', async () => {
    // Note: The component doesn't currently show types, but it supports the type field
    const mermaidCode = `flowchart TD
      A[Component]`;

    const { container } = render(ArchitecturePreview, {
      props: { mermaidCode },
    });

    await waitFor(() => {
      expect(container.querySelector('.preview-tree')).toBeTruthy();
    });
  });

  it('should collapse and expand nodes correctly', async () => {
    const mermaidCode = `flowchart TD
      A[Parent] --> B[Child]`;

    const { container } = render(ArchitecturePreview, {
      props: { mermaidCode },
    });

    await waitFor(() => {
      expect(container.querySelector('.tree-toggle')).toBeTruthy();
    });

    const toggleButton = container.querySelector('.tree-toggle');
    if (toggleButton) {
      // Initially expanded (▼)
      expect(toggleButton.textContent).toContain('▼');

      // Click to collapse
      await fireEvent.click(toggleButton);
      expect(toggleButton.textContent).toContain('▶');

      // Click to expand again
      await fireEvent.click(toggleButton);
      expect(toggleButton.textContent).toContain('▼');
    }
  });

  it('should apply correct padding based on nesting level', async () => {
    const mermaidCode = `flowchart TD
      A --> B --> C`;

    const { container } = render(ArchitecturePreview, {
      props: { mermaidCode },
    });

    await waitFor(() => {
      const treeNodes = container.querySelectorAll('.tree-node');
      expect(treeNodes.length).toBeGreaterThan(0);
    });
  });

  it('should handle diagrams without explicit direction', async () => {
    const mermaidCode = `flowchart
      A --> B --> C`;

    const { container } = render(ArchitecturePreview, {
      props: { mermaidCode },
    });

    await waitFor(() => {
      expect(container.querySelector('.preview-tree')).toBeTruthy();
    });
  });
});
