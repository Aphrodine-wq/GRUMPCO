<script lang="ts">
  import { renderDiagram, exportAsSvg, exportAsPng, downloadFile } from '../lib/mermaid';
  import { parseMermaidNodes, findComponentByNodeId } from '../lib/mermaidParser';
  import SkeletonLoader from './SkeletonLoader.svelte';
  import ComponentInfoPanel from './ComponentInfoPanel.svelte';
  import { createEventDispatcher } from 'svelte';
  import { showToast } from '../stores/toastStore';
  import type { Component } from '../types/workflow';

  interface ArchitectureMetadata {
    components: Component[];
    integrations?: any[];
    dataModels?: any[];
    apiEndpoints?: any[];
  }

  interface Props {
    code?: string;
    architectureMetadata?: ArchitectureMetadata;
  }

  let { code = $bindable(''), architectureMetadata }: Props = $props();

  const dispatch = createEventDispatcher();

  function handleGenerateCode() {
    if (code) {
      dispatch('generate-code', { mermaidCode: code });
    }
  }

  let svgContent = $state('');
  let diagramRef: HTMLElement | null = $state(null);
  let isRendering = $state(false);
  let error = $state<string | null>(null);
  let showShake = $state(false);
  let renderCount = 0;
  let isValidSyntax = $state(true);
  let showSuccessAnimation = $state(false);
  let selectedComponent = $state<Component | null>(null);
  let nodeMap = $state<Map<string, { id: string; label: string }>>(new Map());

  async function performRender(mermaidCode: string) {
    if (!mermaidCode) {
      svgContent = '';
      return;
    }

    // Validate syntax
    isValidSyntax = validateMermaidSyntax(mermaidCode);
    if (!isValidSyntax) {
      error = 'Invalid Mermaid syntax';
      isRendering = false;
      return;
    }

    isRendering = true;
    showShake = false;
    error = null;
    showSuccessAnimation = false;

    try {
      renderCount++;
      const elementId = `mermaid-diagram-${renderCount}`;
      const { svg } = await renderDiagram(elementId, mermaidCode);
      svgContent = svg;

      // Wait for DOM update
      await new Promise((resolve) => setTimeout(resolve, 100));
      const svgElement = diagramRef?.querySelector('svg');
      if (svgElement) {
        // Clean up previous listeners if any
        cleanupNodeClickHandlers(svgElement as SVGElement);

        dispatch('rendered', svgElement);

        // Parse nodes from Mermaid code
        try {
          const parsedNodes = parseMermaidNodes(mermaidCode);
          nodeMap = new Map(Object.entries(parsedNodes));

          // Attach click handlers to SVG nodes if metadata is available
          if (architectureMetadata?.components && architectureMetadata.components.length > 0) {
            // Wait a bit more for SVG to be fully rendered
            await new Promise((resolve) => setTimeout(resolve, 50));
            attachNodeClickHandlers(svgElement as SVGElement);
          }
        } catch (err) {
          console.warn('Failed to parse Mermaid nodes or attach handlers:', err);
          // Continue without click handlers - graceful degradation
        }

        // Show success animation
        showSuccessAnimation = true;
        setTimeout(() => {
          showSuccessAnimation = false;
        }, 2000);
      }
    } catch (err: any) {
      showShake = true;
      setTimeout(() => {
        showShake = false;
      }, 500);
      error = err.message || 'Failed to render diagram';
      isValidSyntax = false;
      dispatch('error', error);
    } finally {
      isRendering = false;
    }
  }

  function validateMermaidSyntax(mermaidCode: string): boolean {
    if (!mermaidCode || mermaidCode.trim().length === 0) {
      return false;
    }

    // Basic syntax validation
    const hasValidStart =
      /^(flowchart|graph|sequenceDiagram|classDiagram|erDiagram|stateDiagram|gantt|pie|gitgraph|journey|requirementDiagram|mindmap|timeline|quadrantChart|sankey-beta|xychart-beta|block-beta|packet-beta|C4Context|C4Container|C4Component|C4Deployment|C4Dynamic)/i.test(
        mermaidCode.trim()
      );
    return hasValidStart;
  }

  async function copyDiagramCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      showToast('Diagram code copied to clipboard', 'success');
    } catch (error) {
      showToast('Failed to copy diagram code', 'error');
    }
  }

  async function exportAsSvgFile() {
    const svgElement = diagramRef?.querySelector('svg') as SVGElement;
    if (svgElement) {
      try {
        const svgData = await exportAsSvg(svgElement);
        downloadFile(svgData, 'diagram.svg', 'image/svg+xml');
        showToast('Diagram exported as SVG', 'success');
      } catch (error) {
        showToast('Failed to export diagram', 'error');
      }
    }
  }

  async function exportAsPngFile() {
    const svgElement = diagramRef?.querySelector('svg') as SVGElement;
    if (svgElement) {
      try {
        const blob = await exportAsPng(svgElement);
        downloadFile(blob, 'diagram.png', 'image/png');
        showToast('Diagram exported as PNG', 'success');
      } catch (error) {
        showToast('Failed to export diagram', 'error');
      }
    }
  }

  function zoomToFit() {
    const svgElement = diagramRef?.querySelector('svg') as SVGElement;
    if (svgElement && diagramRef) {
      const container = diagramRef;
      const svg = svgElement;
      const viewBox = svg.getAttribute('viewBox');
      if (viewBox) {
        const [, , width, height] = viewBox.split(' ').map(Number);
        const scale = Math.min(container.clientWidth / width, container.clientHeight / height, 1);
        svg.style.transform = `scale(${scale})`;
        svg.style.transformOrigin = 'top left';
      }
    }
  }

  function retryRender() {
    if (code) {
      performRender(code);
    }
  }

  function attachNodeClickHandlers(svg: SVGElement) {
    if (!architectureMetadata?.components || architectureMetadata.components.length === 0) {
      // No metadata available - don't attach handlers
      return;
    }

    // Store event listeners for cleanup
    const listeners: Array<{ element: Element; event: string; handler: EventListener }> = [];

    // Find all clickable node elements in the SVG
    // Mermaid typically uses <g> elements with class "node" or similar
    const nodeGroups = svg.querySelectorAll('g.node, g[class*="node"], g[class*="Node"]');

    nodeGroups.forEach((nodeGroup) => {
      // Try to extract node ID from the element
      const nodeId = extractNodeIdFromElement(nodeGroup as SVGElement);

      if (nodeId) {
        const nodeInfo = nodeMap.get(nodeId);
        if (nodeInfo) {
          // Find matching component
          const component = findComponentByNodeId(
            nodeId,
            nodeInfo.label,
            architectureMetadata.components
          );

          if (component) {
            // Find full component data
            const fullComponent = architectureMetadata.components.find(
              (c) => c.id === component.id
            );

            if (fullComponent) {
              // Make nodes look clickable
              (nodeGroup as unknown as SVGElement).style.cursor = 'pointer';

              // Create click handler
              const clickHandler = (e: Event) => {
                e.stopPropagation();
                handleNodeClick(fullComponent, nodeGroup as unknown as SVGElement);
              };

              // Create hover handlers
              const mouseEnterHandler = () => {
                (nodeGroup as unknown as SVGElement).style.opacity = '0.8';
              };

              const mouseLeaveHandler = () => {
                (nodeGroup as unknown as SVGElement).style.opacity = '1';
              };

              // Attach handlers
              nodeGroup.addEventListener('click', clickHandler);
              nodeGroup.addEventListener('mouseenter', mouseEnterHandler);
              nodeGroup.addEventListener('mouseleave', mouseLeaveHandler);

              // Store for cleanup
              listeners.push(
                { element: nodeGroup, event: 'click', handler: clickHandler },
                { element: nodeGroup, event: 'mouseenter', handler: mouseEnterHandler },
                { element: nodeGroup, event: 'mouseleave', handler: mouseLeaveHandler }
              );
            }
          }
        }
      }
    });

    // Also try to find nodes by text labels (fallback strategy)
    const textElements = svg.querySelectorAll('text');
    const processedGroups = new Set<Element>();

    textElements.forEach((textEl) => {
      const textContent = textEl.textContent?.trim();
      if (!textContent) return;

      // Try to find matching component by label
      for (const [nodeId, nodeInfo] of nodeMap.entries()) {
        if (nodeInfo.label.toLowerCase() === textContent.toLowerCase()) {
          const component = findComponentByNodeId(
            nodeId,
            nodeInfo.label,
            architectureMetadata.components
          );

          if (component) {
            const fullComponent = architectureMetadata.components.find(
              (c) => c.id === component.id
            );

            if (fullComponent) {
              // Find parent group
              let parent = textEl.parentElement;
              while (parent && parent !== (svg as unknown as HTMLElement)) {
                if (parent.tagName === 'g' && !processedGroups.has(parent)) {
                  processedGroups.add(parent);
                  (parent as unknown as SVGElement).style.cursor = 'pointer';

                  const clickHandler = (e: Event) => {
                    e.stopPropagation();
                    handleNodeClick(fullComponent, parent as unknown as SVGElement);
                  };

                  const mouseEnterHandler = () => {
                    (parent as unknown as SVGElement).style.opacity = '0.8';
                  };

                  const mouseLeaveHandler = () => {
                    (parent as unknown as SVGElement).style.opacity = '1';
                  };

                  parent.addEventListener('click', clickHandler);
                  parent.addEventListener('mouseenter', mouseEnterHandler);
                  parent.addEventListener('mouseleave', mouseLeaveHandler);

                  listeners.push(
                    { element: parent, event: 'click', handler: clickHandler },
                    { element: parent, event: 'mouseenter', handler: mouseEnterHandler },
                    { element: parent, event: 'mouseleave', handler: mouseLeaveHandler }
                  );

                  break;
                }
                parent = parent.parentElement;
              }
            }
          }
        }
      }
    });

    // Store listeners for cleanup on re-render
    (svg as any).__mermaidListeners = listeners;
  }

  function cleanupNodeClickHandlers(svg: SVGElement | null) {
    if (!svg) return;

    const listeners = (svg as any).__mermaidListeners as
      | Array<{ element: Element; event: string; handler: EventListener }>
      | undefined;
    if (listeners) {
      listeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
      });
      delete (svg as any).__mermaidListeners;
    }
  }

  function extractNodeIdFromElement(element: SVGElement): string | null {
    // Try to get node ID from various attributes
    const id = element.id || element.getAttribute('id');
    if (id) {
      // Remove common prefixes
      return id.replace(/^node-/, '').replace(/^mermaid-/, '');
    }

    // Try to get from class names
    const classList = Array.from(element.classList);
    for (const className of classList) {
      if (className.startsWith('node-')) {
        return className.replace(/^node-/, '');
      }
      // Check if class name matches a node ID
      if (nodeMap.has(className)) {
        return className;
      }
    }

    // Try to get from data attributes
    const dataNodeId = element.getAttribute('data-node-id');
    if (dataNodeId) {
      return dataNodeId;
    }

    return null;
  }

  function handleNodeClick(component: Component, element: SVGElement) {
    if (!component) {
      return;
    }

    selectedComponent = component;

    // Visual feedback - highlight the clicked node
    const svg = element.closest('svg');
    if (svg) {
      // Remove previous highlights
      svg.querySelectorAll('.selected-node').forEach((el) => {
        el.classList.remove('selected-node');
      });

      // Add highlight to clicked node
      element.classList.add('selected-node');

      // Add CSS for highlight if not already present
      if (!svg.querySelector('style[data-node-highlight]')) {
        const style = document.createElement('style');
        style.setAttribute('data-node-highlight', 'true');
        style.textContent = `
          .selected-node {
            filter: drop-shadow(0 0 4px var(--color-primary));
          }
          .selected-node > * {
            stroke: var(--color-primary) !important;
            stroke-width: 2px !important;
          }
        `;
        svg.appendChild(style);
      }
    }
  }

  function closeComponentPanel() {
    selectedComponent = null;

    // Remove highlight
    const svg = diagramRef?.querySelector('svg');
    if (svg) {
      svg.querySelectorAll('.selected-node').forEach((el) => {
        el.classList.remove('selected-node');
      });
    }
  }

  $effect(() => {
    if (code) {
      isValidSyntax = validateMermaidSyntax(code);
      performRender(code);
    } else {
      svgContent = '';
      isValidSyntax = true;
      selectedComponent = null;
    }
  });

  // Cleanup on unmount
  $effect(() => {
    return () => {
      if (diagramRef) {
        const svg = diagramRef.querySelector('svg');
        cleanupNodeClickHandlers(svg);
      }
    };
  });

  export function getSvgElement(): SVGElement | null {
    return (diagramRef?.querySelector('svg') as SVGElement) || null;
  }
</script>

<div class="diagram-container">
  {#if code && !isRendering && !error}
    <div class="diagram-header">
      <div class="diagram-header-left">
        <span class="diagram-title">Architecture Diagram</span>
        {#if isValidSyntax}
          <span class="validation-badge valid" title="Valid Mermaid syntax">✓</span>
        {:else}
          <span class="validation-badge invalid" title="Invalid Mermaid syntax">✗</span>
        {/if}
      </div>
      <div class="diagram-actions">
        <button class="action-btn" onclick={copyDiagramCode} title="Copy diagram code">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
        <button class="action-btn" onclick={exportAsSvgFile} title="Export as SVG">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>
        <button class="action-btn" onclick={exportAsPngFile} title="Export as PNG">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
        </button>
        <button class="action-btn" onclick={zoomToFit} title="Zoom to fit">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z"></path>
          </svg>
        </button>
        <button
          class="action-btn generate-code-btn"
          onclick={handleGenerateCode}
          title="Generate code from this diagram"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
          <span>Generate Code</span>
        </button>
      </div>
    </div>
  {/if}
  {#if isRendering}
    <div class="loading-state">
      <SkeletonLoader variant="diagram" />
    </div>
  {:else if error}
    <div class="error-state" class:shake={showShake}>
      <div class="error-icon">!</div>
      <div class="error-message">{error}</div>
      {#if code}
        <button class="retry-btn" onclick={retryRender}> Retry </button>
      {/if}
    </div>
  {:else if !code}
    <div class="placeholder">Diagram preview</div>
  {:else}
    <div
      bind:this={diagramRef}
      class="diagram-output"
      class:success-animation={showSuccessAnimation}
      class:has-metadata={!!architectureMetadata}
      onclick={(e) => {
        // Close panel if clicking outside the panel itself
        if (selectedComponent && !(e.target as HTMLElement).closest('.component-info-panel')) {
          closeComponentPanel();
        }
      }}
    >
      {@html svgContent}
      {#if selectedComponent}
        <ComponentInfoPanel component={selectedComponent} onClose={closeComponentPanel} />
      {/if}
    </div>
  {/if}
</div>

<style>
  .diagram-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    overflow: auto;
    background: #ffffff;
    min-height: 200px;
    border: 1px solid #e5e5e5;
    border-radius: 6px;
  }

  .diagram-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: #f9fafb;
    border-bottom: 1px solid #e5e5e5;
    border-radius: 6px 6px 0 0;
  }

  .diagram-header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .diagram-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    font-weight: 600;
    color: #000000;
  }

  .validation-badge {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: bold;
  }

  .validation-badge.valid {
    background: #10b981;
    color: #ffffff;
  }

  .validation-badge.invalid {
    background: #ef4444;
    color: #ffffff;
  }

  .diagram-actions {
    display: flex;
    gap: 0.5rem;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: 1px solid #e5e5e5;
    border-radius: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.15s;
  }

  .action-btn:hover {
    background: #f5f5f5;
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .action-btn svg {
    width: 14px;
    height: 14px;
  }

  .generate-code-btn {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: #ffffff;
  }

  .generate-code-btn:hover {
    background: #0052cc;
    border-color: #0052cc;
    color: #ffffff;
  }

  .loading-state {
    width: 100%;
  }

  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 2rem;
    color: #dc2626;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
  }

  .error-state.shake {
    animation: shake 0.5s;
  }

  @keyframes shake {
    0%,
    100% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(-10px);
    }
    75% {
      transform: translateX(10px);
    }
  }

  .error-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #dc2626;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: bold;
  }

  .error-message {
    text-align: center;
    max-width: 400px;
  }

  .retry-btn {
    padding: 0.5rem 1rem;
    background: #dc2626;
    color: #ffffff;
    border: none;
    border-radius: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.15s;
  }

  .retry-btn:hover {
    background: #b91c1c;
  }

  .placeholder {
    color: #6b7280;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
  }

  .diagram-output {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .diagram-output {
    position: relative;
  }

  .diagram-output :global(svg) {
    max-width: 100%;
    height: auto;
    transition: transform 0.3s ease;
  }

  .diagram-output.has-metadata :global(svg g.node),
  .diagram-output.has-metadata :global(svg g[class*='node']) {
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .diagram-output.success-animation {
    animation: successPulse 0.6s ease-out;
  }

  @keyframes successPulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.8;
      transform: scale(1.02);
    }
  }
</style>

