<script lang="ts">
  /**
   * ChatMessageList Component
   *
   * Renders the message list with virtualization for long conversations.
   */
  import { MessageBubble, ScrollNavigation } from './index';
  import type { Message } from '../../types';

  interface Props {
    messages: Message[];
    visibleMessages: Message[];
    hiddenMessageCount: number;
    streaming: boolean;
    streamError: string | null;
    lastUserMessage: string;
    onShowAllMessages: () => void;
    onCopyMessage: (content: string) => void;
    onEditMessage: (index: number, content: string) => void;
    onRegenerateMessage: () => void;
    onRetryAfterError: () => void;
    messagesContainerRef?: HTMLElement | null;
  }

  let {
    messages,
    visibleMessages,
    hiddenMessageCount,
    streaming,
    streamError,
    lastUserMessage,
    onShowAllMessages,
    onCopyMessage,
    onEditMessage,
    onRegenerateMessage,
    onRetryAfterError,
    messagesContainerRef = $bindable(null),
  }: Props = $props();
</script>

<div class="messages-container" bind:this={messagesContainerRef}>
  <div class="messages-inner" class:is-empty={messages.length <= 1}>
    {#if visibleMessages.length === 0 || (visibleMessages.length === 1 && visibleMessages[0].role === 'assistant')}
      <!-- Empty state -->
      <div class="empty-state">
        <h2 class="empty-title">What do you want to build?</h2>
        <p class="empty-subtitle">
          Describe your project and I'll help you design, plan, and code it.
        </p>
      </div>
    {:else}
      <!-- Load more button for hidden messages -->
      {#if hiddenMessageCount > 0}
        <button type="button" class="load-more-btn" onclick={onShowAllMessages}>
          Show {hiddenMessageCount} earlier messages
        </button>
      {/if}

      <!-- Message list -->
      {#each visibleMessages as message, index (index)}
        <MessageBubble
          {message}
          {index}
          isLast={index === visibleMessages.length - 1}
          {streaming}
          onCopy={() => onCopyMessage(typeof message.content === 'string' ? message.content : '')}
          onEdit={() => onEditMessage(index, typeof message.content === 'string' ? message.content : '')}
          onRegenerate={onRegenerateMessage}
        />
      {/each}

      <!-- Error state -->
      {#if !streaming && streamError && lastUserMessage}
        <div class="stream-error-bar">
          <span class="stream-error-status">Error</span>
          <span class="stream-error-message" title={streamError}>
            {streamError.length > 80 ? streamError.slice(0, 77) + '…' : streamError}
          </span>
          <button type="button" class="stream-retry-btn" onclick={onRetryAfterError}>
            Try again
          </button>
        </div>
      {/if}
    {/if}
  </div>
</div>

<ScrollNavigation containerRef={messagesContainerRef} />

<style>
  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 2rem 1rem;
    scrollbar-gutter: stable;
    display: flex;
    flex-direction: column;
    contain: layout style;
  }

  .messages-inner {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    width: 100%;
  }

  .messages-inner.is-empty {
    flex: 1;
    justify-content: flex-start;
    padding-top: 2rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 2rem 1.5rem;
    gap: 0.5rem;
    text-align: center;
    width: 100%;
    min-height: 120px;
  }

  .empty-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text, #111827);
    margin: 0;
  }

  .empty-subtitle {
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0;
  }

  .load-more-btn {
    align-self: center;
    padding: 0.375rem 1rem;
    margin-bottom: 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-primary, #7c3aed);
    background: rgba(124, 58, 237, 0.08);
    border: 1px solid rgba(124, 58, 237, 0.15);
    border-radius: 1rem;
    cursor: pointer;
  }

  .load-more-btn:hover {
    background: rgba(124, 58, 237, 0.14);
  }

  .stream-error-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    margin: 0.5rem 1rem;
    background: var(--color-error-subtle, rgba(239, 68, 68, 0.08));
    border: 1px solid var(--color-error-border, rgba(239, 68, 68, 0.2));
    border-radius: 8px;
    font-size: 0.85rem;
  }

  .stream-error-status {
    font-weight: 600;
    color: var(--color-error, #ef4444);
    flex-shrink: 0;
  }

  .stream-error-message {
    flex: 1;
    min-width: 0;
    color: var(--color-text-secondary, #64748b);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .stream-retry-btn {
    flex-shrink: 0;
    padding: 0.35rem 0.75rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-primary, #7c3aed);
    background: transparent;
    border: 1px solid var(--color-primary, #7c3aed);
    border-radius: 6px;
    cursor: pointer;
  }

  .stream-retry-btn:hover {
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.1));
  }
</style>
