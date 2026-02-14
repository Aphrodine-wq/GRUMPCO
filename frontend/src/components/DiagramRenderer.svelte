<script lang="ts">
  import { mermaidToAscii } from '../lib/asciiDiagram';
  import SkeletonLoader from './SkeletonLoader.svelte';
  import { showToast } from '../stores/toastStore';

  interface Props {
    code?: string;
    architectureMetadata?: any;
    /** When true, hides the header and chrome for embedded use (e.g., in chat messages) */
    compact?: boolean;
    /** Callback when user clicks "Generate Code" */
    onGenerateCode?: (detail: { mermaidCode: string }) => void;
    /** Callback when diagram renders successfully */
    onRendered?: () => void;
    /** Callback on render error */
    onError?: (error: string) => void;
  }

  let {
    code = $bindable(''),
    architectureMetadata,
    compact = false,
    onGenerateCode,
    onRendered,
    onError,
  }: Props = $props();

  function handleGenerateCode() {
    if (code && onGenerateCode) {
      onGenerateCode({ mermaidCode: code });
    }
  }

  // Rendering state
  let svgContent = $state('');
  let asciiContent = $state('');
  let renderMode = $state<'svg' | 'ascii'>('svg');
  let isRendering = $state(false);
  let error = $state<string | null>(null);
  let mermaidReady = $state(false);
  let svgContainer: HTMLDivElement | undefined = $state();

  // Zoom/pan state for SVG
  let zoomLevel = $state(1);
  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 3;
  const ZOOM_STEP = 0.15;

  // Lazy-load mermaid
  let mermaidModule: typeof import('mermaid') | null = null;

  /** Detect dark mode from document theme */
  function detectTheme(): 'dark' | 'default' {
    if (typeof document === 'undefined') return 'default';
    const html = document.documentElement;
    const theme = html.getAttribute('data-theme') || html.getAttribute('data-color-mode') || '';
    if (theme === 'dark') return 'dark';
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'default';
  }

  async function initMermaid() {
    if (mermaidModule) return;
    try {
      const isDark = detectTheme() === 'dark';
      mermaidModule = await import('mermaid');
      mermaidModule.default.initialize({
        startOnLoad: false,
        theme: isDark ? 'dark' : 'default',
        securityLevel: 'loose',
        fontFamily: "'Inter', system-ui, sans-serif",
        themeVariables: isDark
          ? {
              primaryColor: '#7c3aed',
              primaryTextColor: '#e2e8f0',
              lineColor: '#64748b',
              secondaryColor: '#1e293b',
              tertiaryColor: '#0f172a',
            }
          : {
              primaryColor: '#6366f1',
              primaryTextColor: '#1f2937',
              lineColor: '#9ca3af',
              secondaryColor: '#eef2ff',
              tertiaryColor: '#f8fafc',
            },
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          curve: 'basis',
          padding: 12,
        },
        sequence: { useMaxWidth: true },
        gantt: { useMaxWidth: true },
      });
      mermaidReady = true;
    } catch (err) {
      console.warn('[DiagramRenderer] Mermaid load failed, using ASCII fallback:', err);
      renderMode = 'ascii';
    }
  }

  // Initialize mermaid on mount via $effect
  $effect(() => {
    initMermaid();
    // cleanup: no-op, mermaid is a singleton
    return () => {};
  });

  /** Render the diagram as SVG using mermaid, or fall back to ASCII */
  async function performRender(mermaidCode: string) {
    if (!mermaidCode) {
      svgContent = '';
      asciiContent = '';
      return;
    }

    isRendering = true;
    error = null;

    if (renderMode === 'svg' && mermaidReady && mermaidModule) {
      try {
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const { svg } = await mermaidModule.default.render(id, mermaidCode);
        svgContent = svg;
        // Also generate ASCII as fallback for copy/export
        try {
          asciiContent = mermaidToAscii(mermaidCode);
        } catch {
          asciiContent = '';
        }
        onRendered?.();
      } catch (err: any) {
        console.warn('[DiagramRenderer] SVG render failed, trying ASCII:', err);
        // Fall back to ASCII rendering
        try {
          asciiContent = mermaidToAscii(mermaidCode);
          svgContent = '';
          renderMode = 'ascii';
          onRendered?.();
        } catch (asciiErr: any) {
          error = asciiErr.message || 'Failed to render diagram';
          onError?.(error!);
        }
      }
    } else {
      // ASCII mode
      try {
        asciiContent = mermaidToAscii(mermaidCode);
        onRendered?.();
      } catch (err: any) {
        error = err.message || 'Failed to render diagram';
        onError?.(error!);
      }
    }

    isRendering = false;
  }

  function toggleRenderMode() {
    renderMode = renderMode === 'svg' ? 'ascii' : 'svg';
    zoomLevel = 1;
    if (code) performRender(code);
  }

  function zoomIn() {
    zoomLevel = Math.min(ZOOM_MAX, zoomLevel + ZOOM_STEP);
  }

  function zoomOut() {
    zoomLevel = Math.max(ZOOM_MIN, zoomLevel - ZOOM_STEP);
  }

  function resetZoom() {
    zoomLevel = 1;
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

  async function copySvgContent() {
    if (!svgContent) return;
    try {
      await navigator.clipboard.writeText(svgContent);
      showToast('SVG copied to clipboard', 'success');
    } catch (error) {
      showToast('Failed to copy SVG', 'error');
    }
  }

  async function copyAsciiArt() {
    if (!asciiContent) return;
    try {
      await navigator.clipboard.writeText(asciiContent);
      showToast('ASCII diagram copied to clipboard', 'success');
    } catch (error) {
      showToast('Failed to copy ASCII diagram', 'error');
    }
  }

  async function downloadAsTxt() {
    if (!asciiContent) return;
    const blob = new Blob([asciiContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diagram.txt';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Diagram exported as TXT', 'success');
  }

  async function downloadAsSvg() {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diagram.svg';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Diagram exported as SVG', 'success');
  }

  function retryRender() {
    if (code) {
      performRender(code);
    }
  }

  $effect(() => {
    if (code) {
      performRender(code);
    } else {
      svgContent = '';
      asciiContent = '';
    }
  });
</script>

<div class="diagram-container" class:compact>
  {#if code && !isRendering && !error && !compact}
    <div class="diagram-header">
      <div class="diagram-header-left">
        <span class="diagram-icon">
          {#if renderMode === 'svg'}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2"></rect>
              <path d="M3 9h18"></path>
              <path d="M9 21V9"></path>
            </svg>
          {:else}
            ╔═╗
          {/if}
        </span>
        <span class="diagram-title">Architecture Diagram</span>
        <button class="mode-badge" onclick={toggleRenderMode} title="Click to switch render mode">
          {renderMode === 'svg' ? 'SVG' : 'ASCII'}
        </button>
      </div>
      <div class="diagram-actions">
        {#if renderMode === 'svg' && svgContent}
          <div class="zoom-controls">
            <button
              class="zoom-btn"
              onclick={zoomOut}
              title="Zoom out"
              disabled={zoomLevel <= ZOOM_MIN}>−</button
            >
            <button class="zoom-level" onclick={resetZoom} title="Reset zoom">
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              class="zoom-btn"
              onclick={zoomIn}
              title="Zoom in"
              disabled={zoomLevel >= ZOOM_MAX}>+</button
            >
          </div>
        {/if}
        <button
          class="action-btn"
          onclick={renderMode === 'svg' ? copySvgContent : copyAsciiArt}
          title={renderMode === 'svg' ? 'Copy SVG' : 'Copy ASCII art'}
        >
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
        <button class="action-btn" onclick={copyDiagramCode} title="Copy Mermaid source">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
        </button>
        <button
          class="action-btn"
          onclick={renderMode === 'svg' ? downloadAsSvg : downloadAsTxt}
          title={renderMode === 'svg' ? 'Export as SVG' : 'Export as TXT'}
        >
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
    <div class="error-state">
      <div class="error-icon">!</div>
      <div class="error-message">{error}</div>
      {#if code}
        <button class="retry-btn" onclick={retryRender}> Retry </button>
      {/if}
    </div>
  {:else if !code}
    <div class="placeholder">Diagram preview</div>
  {:else}
    <div class="diagram-output" class:compact>
      {#if compact}
        <div class="compact-toolbar">
          <button class="compact-btn" onclick={toggleRenderMode} title="Switch render mode">
            {renderMode === 'svg' ? 'SVG' : 'ASCII'}
          </button>
          <button
            class="compact-btn"
            onclick={renderMode === 'svg' ? copySvgContent : copyAsciiArt}
            title="Copy diagram"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
        </div>
      {/if}

      {#if renderMode === 'svg' && svgContent}
        <div class="svg-viewport" class:compact bind:this={svgContainer}>
          <div
            class="svg-content"
            style="transform: scale({zoomLevel}); transform-origin: top center;"
          >
            {@html svgContent}
          </div>
        </div>
      {:else if asciiContent}
        <pre class="ascii-diagram">{asciiContent}</pre>
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
    min-height: 80px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  }

  .diagram-container.compact {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    background: #ffffff;
    min-height: auto;
    overflow: visible;
    isolation: isolate;
    z-index: 0;
    position: relative;
  }

  .diagram-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.875rem;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
    border-radius: 8px 8px 0 0;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .diagram-header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .diagram-icon {
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
    font-size: 0.65rem;
    color: #6b7280;
    opacity: 0.8;
    display: flex;
    align-items: center;
  }

  .diagram-title {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.75rem;
    font-weight: 600;
    color: #374151;
  }

  .mode-badge {
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
    font-size: 0.55rem;
    font-weight: 700;
    color: #059669;
    background: rgba(5, 150, 105, 0.08);
    border: 1px solid rgba(5, 150, 105, 0.2);
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 0.15s ease-out;
  }

  .mode-badge:hover {
    background: rgba(5, 150, 105, 0.15);
    border-color: rgba(5, 150, 105, 0.4);
  }

  .diagram-actions {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    flex-wrap: wrap;
  }

  /* Zoom controls */
  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 0;
    border: 1px solid #e5e7eb;
    border-radius: 5px;
    overflow: hidden;
    margin-right: 0.25rem;
  }

  .zoom-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    background: transparent;
    border: none;
    font-size: 0.85rem;
    font-weight: 600;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.12s ease-out;
  }

  .zoom-btn:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.04);
    color: #374151;
  }

  .zoom-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .zoom-level {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    color: #6b7280;
    padding: 0 0.4rem;
    border: none;
    border-left: 1px solid #e5e7eb;
    border-right: 1px solid #e5e7eb;
    background: transparent;
    cursor: pointer;
    height: 26px;
    display: flex;
    align-items: center;
    min-width: 36px;
    justify-content: center;
  }

  .zoom-level:hover {
    background: rgba(0, 0, 0, 0.03);
    color: #374151;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.5rem;
    background: transparent;
    border: 1px solid #e5e7eb;
    border-radius: 5px;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.7rem;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.12s ease-out;
  }

  .action-btn:hover {
    background: rgba(0, 0, 0, 0.04);
    border-color: #d1d5db;
    color: #374151;
  }

  .action-btn svg {
    width: 14px;
    height: 14px;
  }

  .generate-code-btn {
    background: rgba(99, 102, 241, 0.12);
    border-color: rgba(99, 102, 241, 0.3);
    color: #6366f1;
  }

  .generate-code-btn:hover {
    background: rgba(99, 102, 241, 0.2);
    border-color: rgba(99, 102, 241, 0.5);
    color: #4f46e5;
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
    color: #f87171;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
  }

  .error-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(248, 113, 113, 0.15);
    border: 2px solid rgba(248, 113, 113, 0.3);
    color: #f87171;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    font-weight: bold;
  }

  .error-message {
    text-align: center;
    max-width: 400px;
    color: #f87171;
  }

  .retry-btn {
    padding: 0.4rem 1rem;
    background: rgba(248, 113, 113, 0.1);
    color: #f87171;
    border: 1px solid rgba(248, 113, 113, 0.25);
    border-radius: 6px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.12s ease-out;
  }

  .retry-btn:hover {
    background: rgba(248, 113, 113, 0.18);
    border-color: rgba(248, 113, 113, 0.4);
  }

  .placeholder {
    color: #484f58;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    padding: 1.5rem;
    text-align: center;
  }

  .diagram-output {
    width: 100%;
    position: relative;
    background: #ffffff;
    min-height: 60px;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 1.25rem;
    border-radius: 0 0 8px 8px;
  }

  .diagram-output.compact {
    padding: 0.625rem;
    background: #ffffff;
    min-height: auto;
    border: none;
    box-shadow: none;
    position: relative;
    border-radius: 8px;
    max-height: 400px;
    overflow-y: auto;
    overflow-x: auto;
  }

  /* Compact floating toolbar */
  .compact-toolbar {
    position: absolute;
    top: 0.4rem;
    right: 0.4rem;
    display: flex;
    gap: 0.25rem;
    opacity: 0;
    transition: opacity 0.15s ease-out;
    z-index: 3;
  }

  .diagram-output:hover .compact-toolbar {
    opacity: 1;
  }

  .compact-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    height: 24px;
    padding: 0 0.35rem;
    background: rgba(22, 27, 34, 0.85);
    border: 1px solid rgba(99, 102, 241, 0.2);
    border-radius: 5px;
    color: #8b949e;
    cursor: pointer;
    transition: all 0.12s ease-out;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.5rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .compact-btn:hover {
    background: rgba(99, 102, 241, 0.15);
    border-color: rgba(99, 102, 241, 0.35);
    color: #c9d1d9;
  }

  /* SVG rendering viewport */
  .svg-viewport {
    width: 100%;
    max-width: 100%;
    overflow: auto;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    min-height: 80px;
  }

  .svg-viewport.compact {
    min-height: auto;
    max-height: 380px;
  }

  .svg-content {
    transition: transform 0.15s ease-out;
    display: flex;
    justify-content: center;
    width: 100%;
  }

  .svg-content :global(svg) {
    max-width: 100%;
    height: auto;
  }

  /* ASCII rendering */
  .ascii-diagram {
    margin: 0 auto;
    padding: 0;
    font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', ui-monospace, monospace;
    font-size: 0.7rem;
    line-height: 1.45;
    color: #1f2937;
    white-space: pre;
    tab-size: 2;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeSpeed;
    letter-spacing: 0;
    background: transparent;
    border: none;
    min-width: min-content;
    max-width: 100%;
  }

  .compact .ascii-diagram {
    font-size: 0.5rem;
    line-height: 1.35;
    transform: scale(0.9);
    transform-origin: top center;
  }

  /* Left accent bar */
  .diagram-output::after {
    content: '';
    position: absolute;
    top: 0.5rem;
    left: 0;
    width: 2px;
    height: calc(100% - 1rem);
    background: #e5e7eb;
    border-radius: 0 1px 1px 0;
    opacity: 0.6;
  }

  .diagram-output.compact::after {
    top: 0.375rem;
    height: calc(100% - 0.75rem);
  }
</style>
