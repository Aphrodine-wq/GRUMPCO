<script lang="ts">
  /**
   * MessageBubble Component (Enhanced)
   *
   * Renders a single message in the chat interface with:
   * - Text content with markdown support
   * - Mermaid diagrams
   * - Tool calls and results
   * - Context and intent blocks
   * - Hover actions: copy, edit, regenerate
   */
  import type { Message, ContentBlock } from '../../types';
  import FrownyFace from '../FrownyFace.svelte';
  import DiagramRenderer from '../DiagramRenderer.svelte';
  import ToolCallCard from '../ToolCallCard.svelte';
  import ToolResultCard from '../ToolResultCard.svelte';
  import ArchitectureResult from './ArchitectureResult.svelte';
  import PRDResult from './PRDResult.svelte';
  import PlanResult from './PlanResult.svelte';
  import CodeResult from './CodeResult.svelte';
  import { Tooltip } from '../../lib/design-system';
  import { parseMessageContent as parseContentBlocks } from '../../utils/contentParser';
  import { showToast } from '../../stores/toastStore';
  import { chatPhaseStore } from '../../stores/chatPhaseStore';
  import { approveDesignPhase } from '../../lib/api';
  import type { PhaseResultBlock } from '../../types';

  interface Props {
    /** The message to render */
    message: Message;
    /** Index of this message in the messages array */
    index: number;
    /** Whether this is the last assistant message */
    isLastAssistant?: boolean;
    /** Whether model details are expanded */
    isModelExpanded?: boolean;
    /** Whether streaming is active */
    streaming?: boolean;
    /** Callback when export SVG is clicked */
    onExportSvg?: (msgIndex: number, blockIndex: number) => void;
    /** Callback when generate code from mermaid is clicked */
    onGenerateCode?: (detail: { mermaidCode: string; framework: string; language: string }) => void;
    /** Callback to toggle model details */
    onToggleModelDetails?: () => void;
    /** Callback to register diagram ref */
    onDiagramRef?: (key: string, el: HTMLElement) => void;
    /** Callback when edit is requested */
    onEdit?: (index: number, content: string) => void;
    /** Callback when regenerate is requested */
    onRegenerate?: () => void;
    /** Callback when copy is requested */
    onCopy?: (content: string) => void;
    /** Callback when thumbs up/down is clicked on a generation result */
    onFeedback?: (index: number, rating: 'up' | 'down') => void;
    /** Session ID for design workflow */
    sessionId?: string;
  }

  let {
    message,
    index,
    isLastAssistant = false,
    isModelExpanded = false,
    streaming = false,
    onExportSvg,
    onGenerateCode,
    onToggleModelDetails,
    onDiagramRef,
    onEdit,
    onRegenerate,
    onCopy,
    onFeedback,
    sessionId,
  }: Props = $props();

  let feedbackSent = $state<'up' | 'down' | null>(null);

  let isHovered = $state(false);
  let showActions = $derived(isHovered && !streaming);

  type PhaseWithData = 'architecture' | 'prd' | 'plan' | 'code';

  async function handlePhaseApprove(phase: PhaseWithData) {
    if (!sessionId) return;
    try {
      const result = await approveDesignPhase(sessionId, true);
      if (result.success) {
        chatPhaseStore.approvePhase(phase);
        showToast(`${phase} approved! Moving to next phase.`, 'success');
      }
    } catch (err) {
      console.error('Failed to approve phase:', err);
      showToast('Failed to approve phase. Please try again.', 'error');
    }
  }

  async function handlePhaseRequestChanges(phase: PhaseWithData, feedback: string) {
    if (!sessionId) return;
    try {
      const result = await approveDesignPhase(sessionId, false, feedback);
      if (result.success) {
        chatPhaseStore.requestChanges(phase, feedback);
        showToast('Feedback submitted. The AI will iterate on this phase.', 'info');
      }
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      showToast('Failed to submit feedback. Please try again.', 'error');
    }
  }

  function parseMessageContent(content: string | ContentBlock[]): ContentBlock[] {
    if (Array.isArray(content)) return content;
    // Use proper parser for structured content blocks
    return parseContentBlocks(content);
  }

  function getPlainTextContent(): string {
    if (typeof message.content === 'string') {
      return message.content;
    }
    return message.content
      .filter((b): b is { type: 'text'; content: string } => b.type === 'text')
      .map((b) => b.content)
      .join('\n');
  }

  function formatTimestamp(timestamp?: number): string {
    if (!timestamp) return '';
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  async function handleCopy() {
    const text = getPlainTextContent();
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard', 'success', 2000);
      onCopy?.(text);
    } catch {
      showToast('Failed to copy', 'error');
    }
  }

  function handleEdit() {
    const text = getPlainTextContent();
    onEdit?.(index, text);
  }

  function handleRegenerate() {
    onRegenerate?.();
  }

  function handleDiagramRef(el: HTMLElement, blockIdx: number) {
    onDiagramRef?.(`${index}-${blockIdx}`, el);
    return {
      update() {
        onDiagramRef?.(`${index}-${blockIdx}`, el);
      },
    };
  }
</script>

<div
  class="message-wrapper {message.role}"
  onmouseenter={() => (isHovered = true)}
  onmouseleave={() => (isHovered = false)}
  role="article"
  aria-label={message.role === 'user' ? 'Your message' : 'Assistant message'}
>
  <!-- Avatar (user: none for personal/clean look; assistant: Frowny with glow) -->
  <div class="message-avatar" class:assistant-only={message.role === 'assistant'}>
    {#if message.role === 'assistant'}
      <div class="frowny-avatar-wrap">
        <FrownyFace size="md" state="idle" animated={true} />
      </div>
    {/if}
  </div>

  <div class="message-content-wrapper">
    <!-- Message metadata -->
    <div class="message-meta">
      <span class="message-role">{message.role === 'user' ? 'You' : 'G-Rump'}</span>

      {#if message.timestamp}
        <span class="message-time">{formatTimestamp(message.timestamp)}</span>
      {/if}

      {#if message.role === 'assistant' && message.model}
        <button
          type="button"
          class="model-badge"
          onclick={() => onToggleModelDetails?.()}
          title="View routing details"
        >
          <span class="model-name">{message.model}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
        </button>
      {/if}
    </div>

    <!-- Expanded model details -->
    {#if message.role === 'assistant' && message.routingDecision && isModelExpanded}
      <div class="model-details">
        {#if message.routingDecision.complexity != null}
          <span class="detail-item">
            <span class="detail-label">Complexity:</span>
            <span class="detail-value">{message.routingDecision.complexity}</span>
          </span>
        {/if}
        {#if message.routingDecision.reason}
          <span class="detail-item">
            <span class="detail-label">Reason:</span>
            <span class="detail-value">{message.routingDecision.reason}</span>
          </span>
        {/if}
        {#if message.routingDecision.estimatedCost != null}
          <span class="detail-item">
            <span class="detail-label">Est. cost:</span>
            <span class="detail-value">{message.routingDecision.estimatedCost}</span>
          </span>
        {/if}
      </div>
    {/if}

    <!-- Message content bubble -->
    <div class="message-bubble">
      {#if typeof message.content === 'string'}
        {#each parseMessageContent(message.content) as block, bIdx}
          {#if block.type === 'text'}
            <div class="text-block">{block.content}</div>
          {:else if block.type === 'code'}
            <div class="code-card">
              <div class="code-header">
                <span class="code-lang">{block.language || 'code'}</span>
                <button
                  type="button"
                  class="code-copy-btn"
                  onclick={async () => {
                    try {
                      await navigator.clipboard.writeText(block.code);
                      showToast('Copied!', 'success', 1500);
                    } catch {
                      showToast('Failed to copy', 'error');
                    }
                  }}>Copy</button
                >
              </div>
              <pre class="code-content"><code>{block.code}</code></pre>
            </div>
          {:else if block.type === 'mermaid'}
            <div class="diagram-embed" use:handleDiagramRef={bIdx}>
              <DiagramRenderer
                code={block.content}
                compact={true}
                on:generate-code={(e) =>
                  onGenerateCode?.({
                    mermaidCode: e.detail.mermaidCode,
                    framework: 'react',
                    language: 'typescript',
                  })}
              />
            </div>
          {/if}
        {/each}
      {:else}
        {#each message.content as block}
          {#if block.type === 'text'}
            <div class="text-block">{block.content}</div>
          {:else if block.type === 'code'}
            <div class="code-card">
              <div class="code-header">
                <span class="code-lang">{block.language || 'code'}</span>
                <button
                  type="button"
                  class="code-copy-btn"
                  onclick={async () => {
                    try {
                      await navigator.clipboard.writeText(block.code);
                      showToast('Copied!', 'success', 1500);
                    } catch {
                      showToast('Failed to copy', 'error');
                    }
                  }}>Copy</button
                >
              </div>
              <pre class="code-content"><code>{block.code}</code></pre>
            </div>
          {:else if block.type === 'context'}
            <details class="context-block">
              <summary>Context: {block.content.mode} · {block.content.toolCount ?? 0} tools</summary
              >
              {#if block.content.capabilities?.length}
                <p class="context-capabilities">{block.content.capabilities.join(', ')}</p>
              {/if}
            </details>
          {:else if block.type === 'intent'}
            <details class="intent-block">
              <summary>Intent</summary>
              <pre class="intent-content">{JSON.stringify(block.content, null, 2)}</pre>
            </details>
          {:else if block.type === 'tool_call'}
            <ToolCallCard toolCall={block} />
          {:else if block.type === 'tool_result'}
            <ToolResultCard toolResult={block} />
          {:else if block.type === 'mermaid'}
            <div class="diagram-embed">
              <DiagramRenderer
                code={block.content}
                compact={true}
                on:generate-code={(e) =>
                  onGenerateCode?.({
                    mermaidCode: e.detail.mermaidCode,
                    framework: 'react',
                    language: 'typescript',
                  })}
              />
            </div>
          {:else if block.type === 'phase_result'}
            {#if block.phase === 'architecture' && block.data}
              <ArchitectureResult
                data={block.data as { mermaidCode: string; description: string }}
                onApprove={() => handlePhaseApprove('architecture')}
                onRequestChanges={(feedback) => handlePhaseRequestChanges('architecture', feedback)}
              />
            {:else if block.phase === 'prd' && block.data}
              <PRDResult
                data={block.data as { content: string; summary: string }}
                onApprove={() => handlePhaseApprove('prd')}
                onRequestChanges={(feedback) => handlePhaseRequestChanges('prd', feedback)}
              />
            {:else if block.phase === 'plan' && block.data}
              <PlanResult
                data={block.data as {
                  tasks: {
                    id: string;
                    title: string;
                    description: string;
                    status: 'completed' | 'pending' | 'in-progress';
                  }[];
                }}
                onApprove={() => handlePhaseApprove('plan')}
                onRequestChanges={(feedback) => handlePhaseRequestChanges('plan', feedback)}
              />
            {:else if block.phase === 'code' && block.data}
              <CodeResult
                data={block.data as {
                  files: { path: string; content: string; language: string }[];
                }}
                onApprove={() => handlePhaseApprove('code')}
                onRequestChanges={(feedback) => handlePhaseRequestChanges('code', feedback)}
              />
            {/if}
          {/if}
        {/each}
      {/if}
    </div>

    <!-- Hover actions -->
    {#if showActions}
      <div class="message-actions" class:visible={showActions}>
        <Tooltip content="Copy" position="top">
          <button type="button" class="action-btn" onclick={handleCopy} aria-label="Copy message">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
        </Tooltip>

        {#if message.role === 'user'}
          <Tooltip content="Edit" position="top">
            <button type="button" class="action-btn" onclick={handleEdit} aria-label="Edit message">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          </Tooltip>
        {/if}

        {#if message.role === 'assistant' && isLastAssistant}
          <Tooltip content="Regenerate" position="top">
            <button
              type="button"
              class="action-btn"
              onclick={handleRegenerate}
              aria-label="Regenerate response"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M3 22v-6h6" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
            </button>
          </Tooltip>
        {/if}

        {#if message.role === 'assistant' && onFeedback}
          <Tooltip content={feedbackSent === 'up' ? 'Thanks!' : 'Good response'} position="top">
            <button
              type="button"
              class="action-btn"
              class:selected={feedbackSent === 'up'}
              disabled={feedbackSent !== null}
              onclick={() => {
                if (!feedbackSent) {
                  feedbackSent = 'up';
                  onFeedback(index, 'up');
                }
              }}
              aria-label="Good response"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"
                />
              </svg>
            </button>
          </Tooltip>
          <Tooltip content={feedbackSent === 'down' ? 'Thanks!' : 'Needs work'} position="top">
            <button
              type="button"
              class="action-btn"
              class:selected={feedbackSent === 'down'}
              disabled={feedbackSent !== null}
              onclick={() => {
                if (!feedbackSent) {
                  feedbackSent = 'down';
                  onFeedback(index, 'down');
                }
              }}
              aria-label="Needs work"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"
                />
              </svg>
            </button>
          </Tooltip>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .message-wrapper {
    display: flex;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-radius: 0.75rem;
    position: relative;
    contain: layout style;
    content-visibility: auto;
    contain-intrinsic-size: 0 80px;
  }

  .message-wrapper:hover {
    background-color: rgba(0, 0, 0, 0.02);
  }

  .message-wrapper.user {
    flex-direction: row-reverse;
  }

  .message-wrapper.user:hover {
    background-color: rgba(124, 58, 237, 0.02);
  }

  /* Avatar */
  .message-avatar {
    flex-shrink: 0;
    margin-top: 0.125rem;
    min-width: 0;
  }

  .message-avatar.assistant-only {
    min-width: 2.5rem;
  }

  .frowny-avatar-wrap {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .frowny-avatar-wrap::before {
    content: '';
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgba(124, 58, 237, 0.2) 0%,
      rgba(124, 58, 237, 0.05) 50%,
      transparent 70%
    );
    animation: frowny-glow 3s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes frowny-glow {
    0%,
    100% {
      opacity: 0.8;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.05);
    }
  }

  /* Content wrapper */
  .message-content-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-width: 80%;
    min-width: 0;
  }

  .message-wrapper.user .message-content-wrapper {
    align-items: flex-end;
  }

  /* Metadata */
  .message-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
  }

  .message-wrapper.user .message-meta {
    flex-direction: row-reverse;
  }

  .message-role {
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .message-time {
    color: var(--color-text-muted);
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
    font-size: 0.6875rem;
  }

  .model-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.5rem;
    background: rgba(124, 58, 237, 0.08);
    border: 1px solid rgba(124, 58, 237, 0.15);
    border-radius: 1rem;
    font-size: 0.6875rem;
    color: var(--color-primary, #7c3aed);
    cursor: pointer;
    transition: all 50ms ease-out;
  }

  .model-badge:hover {
    background: rgba(124, 58, 237, 0.12);
    border-color: rgba(124, 58, 237, 0.25);
  }

  .model-name {
    font-family: ui-monospace, monospace;
    max-width: 10rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Model details */
  .model-details {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    margin: 0.25rem 0;
    background: var(--color-bg-secondary);
    border-radius: 0.5rem;
    font-size: 0.6875rem;
  }

  .detail-item {
    display: flex;
    gap: 0.25rem;
  }

  .detail-label {
    color: var(--color-text-muted);
  }

  .detail-value {
    color: var(--color-text-secondary);
    font-weight: 500;
  }

  /* Message bubble */
  .message-bubble {
    font-size: 0.875rem;
    line-height: 1.55;
    color: var(--color-text);
    white-space: pre-wrap;
    word-break: break-word;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-family:
      'Inter',
      -apple-system,
      system-ui,
      sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeSpeed;
  }

  .message-wrapper.user .message-bubble {
    background: linear-gradient(135deg, var(--color-primary, #7c3aed), #8b5cf6);
    color: white;
    padding: 0.75rem 1rem;
    border-radius: 1.25rem;
    border-bottom-right-radius: 0.375rem;
  }

  .message-wrapper.assistant .message-bubble {
    background: rgba(0, 0, 0, 0.03);
    padding: 0.625rem 0.875rem;
    border-left: 3px solid var(--color-primary, #7c3aed);
    border-radius: 0 0.5rem 0.5rem 0;
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
    font-size: 0.8125rem;
    line-height: 1.65;
    letter-spacing: -0.01em;
  }

  :global(.dark) .message-wrapper.assistant .message-bubble {
    background: rgba(255, 255, 255, 0.03);
  }

  .text-block {
    margin: 0;
    letter-spacing: -0.008em;
  }

  /* Code blocks */
  .code-card {
    background: #1e1e2e;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 0.75rem;
    overflow: hidden;
    margin: 0.25rem 0;
    font-size: 0.8125rem;
  }
  .code-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.375rem 0.75rem;
    background: #181825;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  .code-lang {
    font-size: 0.6875rem;
    font-weight: 600;
    color: #a6adc8;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .code-copy-btn {
    padding: 0.2rem 0.5rem;
    font-size: 0.6875rem;
    font-weight: 600;
    color: #a6adc8;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    cursor: pointer;
    transition: all 50ms ease-out;
  }
  .code-copy-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
    color: #cdd6f4;
  }
  .code-content {
    margin: 0;
    padding: 0.75rem 1rem;
    overflow-x: auto;
    color: #cdd6f4;
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
    font-size: 0.8125rem;
    line-height: 1.6;
    white-space: pre;
    tab-size: 2;
  }
  .code-content code {
    font-family: inherit;
    background: none;
    padding: 0;
    color: inherit;
  }

  /* Inline code in text blocks */
  .text-block :global(code) {
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
    font-size: 0.8125em;
    padding: 0.125em 0.3em;
    background: rgba(124, 58, 237, 0.06);
    border-radius: 0.25rem;
    color: var(--color-primary, #7c3aed);
  }

  .diagram-embed {
    margin: 0.25rem 0;
  }

  /* Context and intent blocks */
  .context-block,
  .intent-block {
    margin: 0.25rem 0;
    padding: 0.5rem 0.75rem;
    background: var(--color-bg-secondary);
    border-radius: 0.5rem;
    font-size: 0.8125rem;
  }

  .context-block summary,
  .intent-block summary {
    cursor: pointer;
    font-weight: 500;
    color: var(--color-text-muted);
  }

  .context-capabilities {
    margin: 0.5rem 0 0;
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .intent-content {
    margin: 0.5rem 0 0;
    padding: 0.5rem;
    background: var(--color-bg-card);
    border-radius: 0.25rem;
    font-size: 0.6875rem;
    overflow-x: auto;
    white-space: pre-wrap;
    max-height: 200px;
    overflow-y: auto;
  }

  /* Hover actions */
  .message-actions {
    display: flex;
    gap: 0.25rem;
    margin-top: 0.375rem;
    opacity: 0;
    transform: translateY(-4px);
    transition:
      opacity 15ms ease-out,
      transform 15ms ease-out;
    pointer-events: none;
  }

  .message-actions.visible {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }

  .message-wrapper.user .message-actions {
    justify-content: flex-end;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 0.375rem;
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .action-btn:hover {
    background: var(--color-bg-secondary);
    border-color: #d1d5db;
    color: var(--color-text-secondary);
  }

  .action-btn:active {
    transform: scale(0.95);
  }

  .action-btn.selected {
    background: var(--color-primary, #7c3aed);
    border-color: var(--color-primary, #7c3aed);
    color: white;
  }

  .action-btn:disabled {
    cursor: default;
    opacity: 0.7;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .message-wrapper,
    .model-badge,
    .message-actions,
    .action-btn {
      transition: none;
    }

    .action-btn:active {
      transform: none;
    }
  }
</style>
