<script lang="ts">
  import Button from '$lib/design-system/components/Button/Button.svelte';
  import Card from '$lib/design-system/components/Card/Card.svelte';
  import { Image, PenTool, FileText, FileCode } from 'lucide-svelte';
  import {
    exportAsSvg,
    exportAsPng,
    exportAsPdf,
    exportAsMarkdown,
    downloadFile,
    copyToClipboard,
  } from '../lib/mermaid';
  import { showToast } from '../stores/toastStore';

  interface Props {
    diagramId: string;
    title?: string;
    description?: string;
    onClose?: () => void;
  }

  let { diagramId, title, description, onClose }: Props = $props();

  let exporting = $state(false);
  let exportFormat = $state<'svg' | 'png' | 'pdf' | 'markdown'>('png');
  let includeTitle = $state(true);
  let shareableLink = $state('');
  let generatingLink = $state(false);

  async function handleExport() {
    exporting = true;
    try {
      const element = document.getElementById(diagramId);
      if (!element) {
        throw new Error('Diagram not found');
      }

      const filename = `diagram-${Date.now()}`;

      switch (exportFormat) {
        case 'svg': {
          const svgData = await exportAsSvg(diagramId);
          downloadFile(svgData, `${filename}.svg`, 'image/svg+xml');
          showToast('SVG exported successfully', 'success');
          break;
        }
        case 'png': {
          const pngBlob = await exportAsPng(diagramId);
          downloadFile(pngBlob, `${filename}.png`, 'image/png');
          showToast('PNG exported successfully', 'success');
          break;
        }
        case 'pdf': {
          const pdfBlob = await exportAsPdf(diagramId, includeTitle ? title : undefined);
          downloadFile(pdfBlob, `${filename}.pdf`, 'application/pdf');
          showToast('PDF exported successfully', 'success');
          break;
        }
        case 'markdown': {
          const markdown = await exportAsMarkdown(
            diagramId,
            includeTitle ? title : undefined,
            description
          );
          downloadFile(markdown, `${filename}.md`, 'text/markdown');
          showToast('Markdown exported successfully', 'success');
          break;
        }
      }

      onClose?.();
    } catch (error) {
      console.error('Export failed:', error);
      showToast('Export failed: ' + (error as Error).message, 'error');
    } finally {
      exporting = false;
    }
  }

  async function handleCopyLink() {
    if (shareableLink) {
      await copyToClipboard(shareableLink);
      showToast('Link copied to clipboard', 'success');
    }
  }

  async function generateShareableLink() {
    generatingLink = true;
    try {
      const element = document.getElementById(diagramId);
      const mermaidCode = element?.querySelector('pre')?.textContent || '';

      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'diagram',
          content: element?.innerHTML || '',
          title,
          description,
          mermaidCode,
          expiresIn: 168, // 7 days
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create shareable link');
      }

      const data = await response.json();
      shareableLink = `${window.location.origin}${data.shareUrl}`;
      showToast('Shareable link generated', 'success');
    } catch (error) {
      console.error('Failed to generate link:', error);
      showToast('Failed to generate link', 'error');
    } finally {
      generatingLink = false;
    }
  }
</script>

<div
  class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
  role="dialog"
  aria-modal="true"
  aria-label="Export Diagram"
  tabindex="-1"
  onclick={onClose}
  onkeydown={(e) => {
    if (e.key === 'Escape') onClose?.();
  }}
>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="w-full max-w-md" role="document" onclick={(e) => e.stopPropagation()}>
    <Card>
      <div class="p-6">
        <!-- Header -->
        <div class="flex justify-between items-start mb-6">
          <div>
            <h2 class="text-2xl font-bold mb-1">Export Diagram</h2>
            <p class="text-sm text-gray-600">Choose format and options</p>
          </div>
          <button
            onclick={onClose}
            class="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <!-- Export Format -->
        <div class="mb-6">
          <span class="block text-sm font-semibold mb-3">Export Format</span>
          <div class="grid grid-cols-2 gap-3">
            {#each [{ value: 'png', label: 'PNG Image', icon: Image }, { value: 'svg', label: 'SVG Vector', icon: PenTool }, { value: 'pdf', label: 'PDF Document', icon: FileText }, { value: 'markdown', label: 'Markdown', icon: FileCode }] as format}
              <button
                onclick={() => (exportFormat = format.value as any)}
                class="p-3 border rounded-lg text-left transition-all"
                class:border-blue-500={exportFormat === format.value}
                class:bg-blue-50={exportFormat === format.value}
                class:border-gray-300={exportFormat !== format.value}
              >
                <div class="mb-1">
                  {#if format.icon}
                    {@const FormatIcon = format.icon}
                    <FormatIcon size={24} />
                  {/if}
                </div>
                <div class="text-sm font-medium">{format.label}</div>
              </button>
            {/each}
          </div>
        </div>

        <!-- Options -->
        <div class="mb-6">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={includeTitle}
              class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span class="text-sm">Include title in export</span>
          </label>
        </div>

        <!-- Shareable Link -->
        <div class="mb-6 p-4 bg-gray-50 rounded-lg">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-semibold">Shareable Link</h3>
            {#if !shareableLink}
              <Button
                size="sm"
                variant="ghost"
                onclick={generateShareableLink}
                disabled={generatingLink}
                loading={generatingLink}
              >
                Generate
              </Button>
            {/if}
          </div>
          {#if shareableLink}
            <div class="flex gap-2">
              <input
                type="text"
                readonly
                value={shareableLink}
                class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded bg-white"
              />
              <Button size="sm" onclick={handleCopyLink}>Copy</Button>
            </div>
            <p class="text-xs text-gray-500 mt-2">Link expires in 7 days • View-only access</p>
          {:else}
            <p class="text-sm text-gray-600">Create a shareable link for view-only access</p>
          {/if}
        </div>

        <!-- Actions -->
        <div class="flex gap-3">
          <Button variant="ghost" onclick={onClose} disabled={exporting} class="flex-1">
            Cancel
          </Button>
          <Button onclick={handleExport} disabled={exporting} loading={exporting} class="flex-1">
            Export {exportFormat.toUpperCase()}
          </Button>
        </div>
      </div>
    </Card>
  </div>
</div>

<style>
  /* Ensure checkbox is visible */
  input[type='checkbox'] {
    appearance: none;
    -webkit-appearance: none;
    border: 2px solid #d1d5db;
    background: white;
  }

  input[type='checkbox']:checked {
    background: #3b82f6;
    border-color: #3b82f6;
    background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e");
  }
</style>
