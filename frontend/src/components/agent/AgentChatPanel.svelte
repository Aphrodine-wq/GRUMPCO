<script lang="ts">
  /**
   * AgentChatPanel – Chat message display, streaming, and input area.
   * Extracted from AgentScreen.svelte.
   */
  import { Button, Spinner } from '../../lib/design-system';
  import { Bot, Send } from 'lucide-svelte';
  import CodeBlock from '../chat/CodeBlock.svelte';
  import ToolCallCard from '../ToolCallCard.svelte';
  import ToolResultCard from '../ToolResultCard.svelte';
  import DiagramRenderer from '../DiagramRenderer.svelte';
  import { streamChat, type ChatStreamEvent } from '../../lib/chatStreaming';
  import type { ContentBlock, Message } from '../../types';

  // ── Types ─────────────────────────────────────────────────────────────────
  interface AgentMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string | ContentBlock[];
    timestamp: number;
  }

  interface ParsedBlock {
    type: 'text' | 'code' | 'mermaid';
    content: string;
    language?: string;
  }

  /** Configuration passed from the parent AgentScreen */
  interface ChatConfig {
    selectedProvider: string;
    selectedModel: string;
    enabledSkillIds: string[];
    memoryEnabled: boolean;
    temperature: number;
    maxTurns: number;
    budgetLimit: number;
    systemPrompt: string;
    workspaceRoot: string;
    toolAllowlist: string[];
    toolDenylist: string[];
    allowedDirs: string[];
    agentProfile: 'general' | 'router' | 'frontend' | 'backend' | 'devops' | 'test';
    includeRagContext: boolean;
    modelPreset: 'fast' | 'balanced' | 'quality';
    largeContextMode: boolean;
  }

  // ── Props ─────────────────────────────────────────────────────────────────
  interface Props {
    config: ChatConfig;
  }
  let { config }: Props = $props();

  // ── State ─────────────────────────────────────────────────────────────────
  let chatMessages = $state<AgentMessage[]>([]);
  let chatInput = $state('');
  let chatStreaming = $state(false);
  let chatAbortController = $state<AbortController | null>(null);
  let chatScrollContainer: HTMLDivElement | null = $state(null);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function scrollToBottom() {
    if (chatScrollContainer) {
      requestAnimationFrame(() => {
        chatScrollContainer!.scrollTop = chatScrollContainer!.scrollHeight;
      });
    }
  }

  function parseMarkdownContent(text: string): ParsedBlock[] {
    const blocks: ParsedBlock[] = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        const textContent = text.slice(lastIndex, match.index).trim();
        if (textContent) blocks.push({ type: 'text', content: textContent });
      }

      const language = match[1] || 'text';
      const code = match[2].trim();

      if (language === 'mermaid') {
        blocks.push({ type: 'mermaid', content: code });
      } else {
        blocks.push({ type: 'code', content: code, language });
      }
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      const remaining = text.slice(lastIndex).trim();
      if (remaining) blocks.push({ type: 'text', content: remaining });
    }

    return blocks.length > 0 ? blocks : [{ type: 'text', content: text }];
  }

  // ── Chat Actions ──────────────────────────────────────────────────────────
  async function sendChatMessage() {
    const text = chatInput.trim();
    if (!text || chatStreaming) return;

    const userMessage: AgentMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    chatMessages = [...chatMessages, userMessage];
    chatInput = '';
    chatStreaming = true;
    scrollToBottom();

    const assistantMessage: AgentMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: [],
      timestamp: Date.now(),
    };
    chatMessages = [...chatMessages, assistantMessage];

    const abortCtrl = new AbortController();
    chatAbortController = abortCtrl;

    try {
      const apiMessages: Message[] = chatMessages.slice(0, -1).map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      }));

      const blocks = await streamChat(apiMessages, {
        mode: 'code',
        sessionType: 'gAgent',
        provider: config.selectedProvider || undefined,
        modelId: config.selectedModel || undefined,
        signal: abortCtrl.signal,
        enabledSkillIds: config.enabledSkillIds.length > 0 ? config.enabledSkillIds : undefined,
        memoryContext: config.memoryEnabled ? undefined : [],
        temperature: config.temperature,
        maxTurns: config.maxTurns,
        budgetLimit: config.budgetLimit,
        systemPrompt: config.systemPrompt || undefined,
        workspaceRoot: config.workspaceRoot || undefined,
        toolAllowlist: config.toolAllowlist.length > 0 ? config.toolAllowlist : undefined,
        toolDenylist: config.toolDenylist.length > 0 ? config.toolDenylist : undefined,
        guardRailOptions:
          config.allowedDirs.length > 0 ? { allowedDirs: config.allowedDirs } : undefined,
        agentProfile: config.agentProfile,
        includeRagContext: config.includeRagContext,
        modelPreset: config.modelPreset,
        largeContext: config.largeContextMode,
        onEvent: (event: ChatStreamEvent) => {
          chatMessages = chatMessages.map((m, i) =>
            i === chatMessages.length - 1 ? { ...m, content: [...event.blocks] } : m
          );
          scrollToBottom();
        },
      });

      chatMessages = chatMessages.map((m, i) =>
        i === chatMessages.length - 1 ? { ...m, content: blocks } : m
      );
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') {
        const errMsg = e instanceof Error ? e.message : 'Unknown error';
        chatMessages = chatMessages.map((m, i) =>
          i === chatMessages.length - 1
            ? { ...m, content: [{ type: 'text', content: `❌ Error: ${errMsg}` }] }
            : m
        );
      }
    } finally {
      chatStreaming = false;
      chatAbortController = null;
      scrollToBottom();
    }
  }

  function handleChatKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  }

  function stopStreaming() {
    if (chatAbortController) {
      chatAbortController.abort();
      chatAbortController = null;
      chatStreaming = false;
    }
  }

  /** Cleanup on destroy — abort any in-flight stream */
  export function destroy() {
    if (chatAbortController) chatAbortController.abort();
  }
</script>

{#if chatMessages.length === 0}
  <div class="chat-empty">
    <div class="chat-empty-icon">
      <Bot size={48} strokeWidth={1.5} />
    </div>
    <h2>Agent Chat</h2>
    <p>Send a message to start a conversation with your autonomous agent.</p>
    <p class="chat-hint">
      The agent uses the model, skills, and integrations you've configured on the left.
    </p>
  </div>
{:else}
  <div class="chat-messages" bind:this={chatScrollContainer}>
    {#each chatMessages as message (message.id)}
      <div class="chat-bubble {message.role}">
        <div class="bubble-header">
          {#if message.role === 'user'}
            <span class="bubble-role">You</span>
          {:else}
            <Bot size={14} />
            <span class="bubble-role">Agent</span>
          {/if}
        </div>
        <div class="bubble-content">
          {#if typeof message.content === 'string'}
            {#each parseMarkdownContent(message.content) as parsedBlock}
              {#if parsedBlock.type === 'text'}
                <p class="chat-text">{parsedBlock.content}</p>
              {:else if parsedBlock.type === 'code'}
                <CodeBlock code={parsedBlock.content} language={parsedBlock.language || 'text'} />
              {:else if parsedBlock.type === 'mermaid'}
                <DiagramRenderer code={parsedBlock.content} compact={true} />
              {/if}
            {/each}
          {:else if Array.isArray(message.content)}
            {#each message.content as block}
              {#if block.type === 'text'}
                {#each parseMarkdownContent((block as { content: string }).content || '') as parsedBlock}
                  {#if parsedBlock.type === 'text'}
                    <p class="chat-text">{parsedBlock.content}</p>
                  {:else if parsedBlock.type === 'code'}
                    <CodeBlock
                      code={parsedBlock.content}
                      language={parsedBlock.language || 'text'}
                    />
                  {:else if parsedBlock.type === 'mermaid'}
                    <DiagramRenderer code={parsedBlock.content} compact={true} />
                  {/if}
                {/each}
              {:else if block.type === 'code'}
                <CodeBlock
                  code={(block as { code: string }).code}
                  language={(block as { language: string }).language || 'text'}
                />
              {:else if block.type === 'mermaid'}
                <DiagramRenderer code={(block as { content: string }).content} compact={true} />
              {:else if block.type === 'tool_call'}
                <ToolCallCard toolCall={block} />
              {:else if block.type === 'tool_result'}
                <ToolResultCard toolResult={block} />
              {/if}
            {/each}
          {/if}
        </div>
      </div>
    {/each}

    {#if chatStreaming}
      <div class="streaming-indicator">
        <Spinner size="sm" />
        <span>Agent is thinking…</span>
        <Button variant="ghost" size="sm" onclick={stopStreaming}>Stop</Button>
      </div>
    {/if}
  </div>
{/if}

<!-- Chat Input -->
<div class="chat-input-area">
  <div class="chat-input-wrapper">
    <textarea
      class="chat-textarea"
      placeholder="Message the Agent…"
      bind:value={chatInput}
      onkeydown={handleChatKeydown}
      rows={1}
      disabled={chatStreaming}
    ></textarea>
    <button
      class="send-btn"
      onclick={sendChatMessage}
      disabled={!chatInput.trim() || chatStreaming}
      title="Send"
    >
      <Send size={18} />
    </button>
  </div>
  <div class="chat-input-meta">
    <span class="meta-model"
      >{config.selectedProvider
        ? `${config.selectedProvider}:${config.selectedModel}`
        : 'Auto'}</span
    >
    <span class="meta-dot">·</span>
    <span class="meta-mode">Agent Mode</span>
    {#if config.temperature !== 0.7}
      <span class="meta-dot">·</span>
      <span class="meta-temp">T={config.temperature}</span>
    {/if}
    {#if config.maxTurns !== 25}
      <span class="meta-dot">·</span>
      <span class="meta-turns">{config.maxTurns} turns</span>
    {/if}
  </div>
</div>

<style>
  .chat-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    text-align: center;
    padding: 3rem;
    color: var(--color-text-muted, #8b8b9a);
  }

  .chat-empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    border-radius: 20px;
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(124, 58, 237, 0.04));
    color: var(--color-primary, #7c3aed);
    margin-bottom: 1.5rem;
  }

  .chat-empty h2 {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-text, #f0f0f5);
    margin: 0 0 0.5rem;
  }

  .chat-empty p {
    margin: 0 0 0.25rem;
    font-size: 0.9375rem;
    max-width: 400px;
    line-height: 1.5;
  }

  .chat-hint {
    font-size: 0.8125rem !important;
    opacity: 0.7;
    margin-top: 0.5rem !important;
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .chat-bubble {
    max-width: 85%;
    border-radius: 16px;
    padding: 0.75rem 1rem;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .chat-bubble.user {
    align-self: flex-end;
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(124, 58, 237, 0.1));
    border: 1px solid rgba(124, 58, 237, 0.2);
  }

  .chat-bubble.assistant {
    align-self: flex-start;
    background: var(--color-bg-card, rgba(20, 20, 32, 0.8));
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.06));
  }

  .bubble-header {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-bottom: 0.375rem;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--color-text-muted, #8b8b9a);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .bubble-role {
    font-size: 0.6875rem;
  }

  .bubble-content {
    font-size: 0.875rem;
    color: var(--color-text, #f0f0f5);
    line-height: 1.6;
  }

  .bubble-content p {
    margin: 0;
  }

  .chat-text {
    white-space: pre-wrap;
    word-break: break-word;
  }

  .streaming-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    color: var(--color-text-muted, #8b8b9a);
    font-size: 0.8125rem;
  }

  /* Chat Input */
  .chat-input-area {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-border, rgba(255, 255, 255, 0.06));
    background: var(--color-bg-card, rgba(20, 20, 32, 0.5));
  }

  .chat-input-wrapper {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    background: var(--color-bg-subtle, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
    border-radius: 14px;
    padding: 0.625rem 0.75rem;
    transition: border-color 0.2s;
  }

  .chat-input-wrapper:focus-within {
    border-color: rgba(124, 58, 237, 0.4);
    box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.08);
  }

  .chat-textarea {
    flex: 1;
    border: none;
    background: transparent;
    color: var(--color-text, #f0f0f5);
    font-size: 0.9375rem;
    font-family: inherit;
    resize: none;
    outline: none;
    line-height: 1.5;
    max-height: 120px;
    min-height: 24px;
  }

  .chat-textarea::placeholder {
    color: var(--color-text-muted, #5a5a6e);
  }

  .send-btn {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    border: none;
    background: var(--color-primary, #7c3aed);
    color: white;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .send-btn:hover:not(:disabled) {
    background: var(--color-primary-hover, #6d28d9);
    transform: scale(1.05);
  }

  .send-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .chat-input-meta {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding-top: 0.5rem;
    font-size: 0.6875rem;
    color: var(--color-text-muted, #5a5a6e);
  }

  .meta-dot {
    opacity: 0.5;
  }
  .meta-temp,
  .meta-turns {
    color: var(--color-primary, #7c3aed);
  }
</style>
