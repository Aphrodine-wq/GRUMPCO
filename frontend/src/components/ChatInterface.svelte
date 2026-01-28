<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { get } from 'svelte/store';

  import DiagramRenderer from './DiagramRenderer.svelte';
  import SuggestionChips from './SuggestionChips.svelte';
  import GRumpBlob from './GRumpBlob.svelte';
  import ToolCallCard from './ToolCallCard.svelte';
  import ToolResultCard from './ToolResultCard.svelte';
  import ShipMode from './ShipMode.svelte';
  import SettingsScreen from './SettingsScreen.svelte';
  import { Badge, Button } from '../lib/design-system';
  import { exportAsSvg } from '../lib/mermaid';
  // import {
  //   trackMessageSent,
  import {
    trackMessageSent,
    trackDiagramGenerated,
    trackError,
    trackTemplateUsed,
  } from '../lib/analytics';
  import { showToast } from '../stores/toastStore';
  import { processError, logError } from '../utils/errorHandler';
  import { sessionsStore, currentSession } from '../stores/sessionsStore';
  import { getCurrentProjectId } from '../stores/projectStore';
  import { chatModeStore } from '../stores/chatModeStore';
  import { workspaceStore } from '../stores/workspaceStore'; // Already enabled
  import { codeSessionsStore } from '../stores/codeSessionsStore';
  import { openModal } from '../stores/clarificationStore';
  import {
    streamPrd,
    startCodeGeneration,
    downloadProject,
    reset as resetWorkflow,
    codegenSession,
  } from '../stores/workflowStore';
  import { parseAssistantResponse } from '../utils/responseParser';
  import { flattenTextContent } from '../utils/contentParser';
  import { generatePlan } from '../stores/planStore';
  import { startSpecSession } from '../stores/specStore';
  import { fetchApi } from '../lib/api.js';
  import { settingsStore } from '../stores/settingsStore';
  import { colors } from '../lib/design-system/tokens/colors';
  import { showSettings } from '../stores/uiStore';
  import type { Message, ContentBlock } from '../types';

  interface Props {
    initialMessages?: Message[];
  }

  let { initialMessages = $bindable(undefined) }: Props = $props();

  const defaultMessage: Message = {
    role: 'assistant',
    content:
      "Tell me what you want to build. I'll design the architecture and help you code it section by section.",
  };

  let messages = $state<Message[]>(initialMessages || [defaultMessage]);
  let inputText = $state('');
  let messagesRef: HTMLElement | null = $state(null);
  let inputRef: HTMLInputElement | null = $state(null);
  let streaming = $state(false);
  let streamingContent = $state('');
  let streamingBlocks = $state<ContentBlock[]>([]);
  let diagramRefs: Record<string, HTMLElement> = $state({});
  let lastUserMessage = $state('');
  let activeController: AbortController | null = $state(null);
  let workspaceInput = $state('');
  let chatMode: 'normal' | 'plan' | 'spec' | 'ship' | 'execute' = $state('normal');
  let currentPlanId = $state<string | null>(null);
  let currentSpecSessionId = $state<string | null>(null);
  let commandPaletteOpen = $state(false);
  let typingTimeout: ReturnType<typeof setTimeout> | null = null;
  let editingMessageIndex = $state<number | null>(null);
  let isTyping = $state(false);
  let lastError = $state(false);
  let loadSessionModalOpen = $state(false);

  // Use the global showSettings store
  const showSettingsValue = $derived($showSettings);

  // Re-enabled projectStore usage
  const projectId = getCurrentProjectId();

  $effect(() => {
    if (chatModeStore) {
      chatMode = $chatModeStore;
    }
  });

  function parseMessageContent(content: string | ContentBlock[]): ContentBlock[] {
    if (Array.isArray(content)) return content;
    // Basic text content might contain mermaid code blocks
    return flattenTextContent(content);
  }

  function flattenMessagesForChatApi(
    msgs: Message[]
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    return msgs
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: typeof m.content === 'string' ? m.content : flattenTextContent(m.content),
      }))
      .filter((m) => (m.content || '').trim().length > 0);
  }

  function hasMermaidInStream(): boolean {
    return streamingContent.includes('```mermaid');
  }

  function getBuildingPhase(): string {
    const content = streamingContent.toLowerCase();
    if (!content) return 'Understanding your idea...';
    if (content.includes('```mermaid')) return 'Building architecture...';
    if (content.includes('frontend') || content.includes('backend') || content.includes('api')) {
      return 'Designing system...';
    }
    return 'Analyzing requirements...';
  }

  function scrollToBottom() {
    if (messagesRef) {
      messagesRef.scrollTop = messagesRef.scrollHeight;
    }
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

  function handleInputChange() {
    isTyping = true;
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      isTyping = false;
    }, 500);
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      commandPaletteOpen = !commandPaletteOpen;
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === '/') {
      event.preventDefault();
      showToast(
        'Keyboard Shortcuts:\nCtrl/Cmd+K: Command Palette\nCtrl/Cmd+/: Show Shortcuts\nEscape: Cancel\nArrow Up: Edit Last Message',
        'info',
        5000
      );
      return;
    }
    if (event.key === 'Escape' && streaming) {
      event.preventDefault();
      cancelGeneration();
      return;
    }
    if (event.key === 'ArrowUp' && document.activeElement === inputRef && !inputText.trim()) {
      event.preventDefault();
      const lastUserMessageIndex = messages.findLastIndex((m) => m.role === 'user');
      if (lastUserMessageIndex >= 0) {
        const lastMsg = messages[lastUserMessageIndex];
        if (typeof lastMsg.content === 'string') {
          inputText = lastMsg.content;
          editingMessageIndex = lastUserMessageIndex;
        }
      }
    }
  }

  function isLastAssistantMessage(index: number): boolean {
    return index === messages.length - 1 && messages[index].role === 'assistant';
  }

  async function sendMessage() {
    const text = inputText.trim();
    if (!text || streaming) return;
    // --- Mode Switching Logic ---
    const mode = get(chatModeStore);
    lastUserMessage = text;
    lastError = false;
    trackMessageSent(text.length);
    if (mode === 'code' && chatMode === 'plan') {
      try {
        const ws = workspaceInput.trim() || get(workspaceStore) || undefined;
        await generatePlan(text, ws);
        streaming = false;
      } catch (e: any) {
        lastError = true;
        streaming = false;
        showToast(e.message || 'Error generating plan', 'error');
      }
      return;
    }

    if (mode === 'code' && chatMode === 'spec') {
      try {
        const ws = workspaceInput.trim() || get(workspaceStore) || undefined;
        await startSpecSession(text, ws);
        streaming = false;
      } catch (e: any) {
        lastError = true;
        streaming = false;
        showToast(e.message || 'Error starting spec session', 'error');
      }
      return;
    }

    if (mode === 'code') {
      // Standard code mode message
      // We'll treat 'code' mode in 'normal' chat submode as a regular chat
      // unless we want to trigger specific coding actions.
      // For now, let's route to standard stream for 'normal' submode,
      // or specialized streams for others if implemented.
      // However, pure "Code Mode" usually implies `codeSessionsStore`.
      // Let's use runCodeModeStream if intended.
      await runCodeModeStream(controller.signal);
      return;
    }

    if (mode === 'design') {
      await runDesignModeStream(controller.signal);
      return;
    }

    // Default / Argument / Ship mode fallback
    if (editingMessageIndex !== null && editingMessageIndex >= 0) {
      const updated = [...messages];
      updated[editingMessageIndex] = { role: 'user', content: text, timestamp: Date.now() };
      messages = updated;
      editingMessageIndex = null;
    } else {
      messages = [...messages, { role: 'user', content: text, timestamp: Date.now() }];
    }
    inputText = '';
    isTyping = false;
    if (typingTimeout) clearTimeout(typingTimeout);
    streaming = true;
    streamingContent = '';
    streamingBlocks = [];
    await tick();
    scrollToBottom();
    const controller = new AbortController();
    activeController = controller;
    const timeoutMs = mode === 'code' || mode === 'argument' ? 120000 : 60000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      if (mode === 'code' || mode === 'argument') await runCodeModeStream(controller.signal);
      else await runDesignModeStream(controller.signal);
    } catch (err: any) {
      streaming = false;
      lastError = true;
      const errorContext = processError(err, async () => {
        if (lastUserMessage) {
          inputText = lastUserMessage;
          await tick();
          sendMessage();
        }
      });
      logError(errorContext, { mode: get(chatModeStore), workspaceRoot: get(workspaceStore) });
      trackError('api_error', errorContext.message);
      showToast(errorContext.userMessage, 'error', errorContext.retryable ? 0 : 5000, {
        persistent: errorContext.retryable,
        actions: errorContext.recovery,
      });
    } finally {
      clearTimeout(timeoutId);
      activeController = null;
    }
  }

  async function runDesignModeStream(signal: AbortSignal) {
    const text = lastUserMessage;
    const response = await fetchApi('/api/generate-diagram-stream', {
      method: 'POST',
      body: JSON.stringify({ message: text }),
      signal,
    });
    if (!response.ok) throw new Error(`Server error (${response.status})`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.text) {
            streamingContent += parsed.text;
            await tick();
            scrollToBottom();
          }
        } catch {
          /* ignore */
        }
      }
    }
    const parsed = parseAssistantResponse(streamingContent);
    if (parsed.type === 'clarification' && parsed.clarification) {
      streaming = false;
      streamingContent = '';
      await openModal(parsed.clarification);
      return;
    }
    messages = [
      ...messages,
      { role: 'assistant', content: streamingContent, timestamp: Date.now() },
    ];
    streaming = false;
    streamingContent = '';
    if (parsed.mermaidCode) trackDiagramGenerated('mermaid', true);
    if ($currentSession) sessionsStore.updateSession($currentSession.id, messages);
    else sessionsStore.createSession(messages);
    dispatch('messages-updated', messages);
  }

  async function runCodeModeStream(signal: AbortSignal) {
    const apiMessages = flattenMessagesForChatApi(messages);
    if (apiMessages.length === 0) throw new Error('No messages to send');
    let ws = workspaceInput.trim() || get(workspaceStore) || undefined;
    if (ws) workspaceStore.setWorkspace(ws);
    const body: Record<string, unknown> = {
      messages: apiMessages,
      workspaceRoot: ws || undefined,
      mode:
        get(chatModeStore) === 'argument'
          ? 'argument'
          : chatMode !== 'normal'
            ? chatMode
            : 'normal',
      planId: currentPlanId || undefined,
      specSessionId: currentSpecSessionId || undefined,
    };
    const s = settingsStore.getCurrent();
    if (s?.models?.defaultProvider) body.provider = s.models.defaultProvider;
    if (s?.models?.defaultModelId) body.modelId = s.models.defaultModelId;
    if (s?.guardRails?.autonomousMode) body.autonomous = true;
    if (s?.guardRails?.useLargeContext) body.largeContext = true;
    const response = await fetchApi('/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) throw new Error(`Server error (${response.status})`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lineList = buffer.split('\n');
      buffer = lineList.pop() || '';
      for (const line of lineList) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6);
        try {
          const ev = JSON.parse(raw);
          if (ev.type === 'autonomous' && ev.value) {
            /* Yolo mode: backend signaled autonomous; confirmations are skipped by backend. */
          } else if (ev.type === 'text' && ev.text) {
            const last = streamingBlocks[streamingBlocks.length - 1];
            if (last?.type === 'text') {
              streamingBlocks = [
                ...streamingBlocks.slice(0, -1),
                { type: 'text', content: last.content + ev.text },
              ];
            } else {
              streamingBlocks = [...streamingBlocks, { type: 'text', content: ev.text }];
            }
            await tick();
            scrollToBottom();
          } else if (ev.type === 'tool_call' && ev.id && ev.name) {
            streamingBlocks = [
              ...streamingBlocks,
              {
                type: 'tool_call',
                id: ev.id,
                name: ev.name,
                input: ev.input ?? {},
                status: 'executing',
              },
            ];
            await tick();
            scrollToBottom();
          } else if (ev.type === 'tool_result' && ev.id && ev.toolName) {
            const idx = streamingBlocks.findIndex(
              (b) => b.type === 'tool_call' && (b as any).id === ev.id
            );
            if (idx >= 0) {
              const blk = streamingBlocks[idx] as any;
              const updated = [...streamingBlocks];
              updated[idx] = { ...blk, status: ev.success ? 'success' : 'error' };
              streamingBlocks = updated;
            }
            streamingBlocks = [
              ...streamingBlocks,
              {
                type: 'tool_result',
                id: ev.id,
                toolName: ev.toolName,
                output: ev.output ?? '',
                success: ev.success ?? false,
                executionTime: ev.executionTime ?? 0,
                diff: ev.diff,
              },
            ];
            await tick();
            scrollToBottom();
          }
        } catch (e) {
          /* ignore */
        }
      }
    }
    messages = [
      ...messages,
      { role: 'assistant', content: [...streamingBlocks], timestamp: Date.now() },
    ];
    streaming = false;
    streamingBlocks = [];
    if ($currentSession) sessionsStore.updateSession($currentSession.id, messages);
    else sessionsStore.createSession(messages);
    dispatch('messages-updated', messages);
  }

  function cancelGeneration() {
    if (activeController) {
      activeController.abort();
      activeController = null;
    }
    streaming = false;
    streamingContent = '';
    streamingBlocks = [];
  }

  function retryLastMessage() {
    if (lastUserMessage) {
      inputText = lastUserMessage;
      sendMessage();
    }
  }

  function handleTemplateSelect(event: CustomEvent) {
    if (event.detail.id === 'ship-mode') {
      chatMode = 'ship';
      trackTemplateUsed('ship-mode');
      return;
    }
    inputText = event.detail.prompt;
    trackTemplateUsed(event.detail.id || 'unknown');
    inputRef?.focus();
  }

  function exportSvg(msgIndex: number, blockIndex: number) {
    const key = `${msgIndex}-${blockIndex}`;
    const svgElement = diagramRefs[key]?.querySelector('svg') as SVGElement;
    if (svgElement) exportAsSvg(svgElement, 'diagram.svg');
  }

  function setupDiagramRef(el: HTMLElement, params: { index: number; blockIdx: number }) {
    diagramRefs[`${params.index}-${params.blockIdx}`] = el;
    return {
      update(newParams: { index: number; blockIdx: number }) {
        diagramRefs[`${newParams.index}-${newParams.blockIdx}`] = el;
      },
    };
  }

  const dispatch = createEventDispatcher<{ 'messages-updated': Message[] }>();

  async function handleProceedToPrd() {
    for await (const _ of streamPrd()) {
    }
  }
  async function handleProceedToCodegen() {
    await startCodeGeneration(get(currentSession)?.projectId ?? getCurrentProjectId() ?? undefined);
  }
  async function handleDownload() {
    await downloadProject();
  }

  async function handlePushToGitHub(detail: { repoName: string }) {
    const sessionId = get(codegenSession)?.sessionId;
    if (!sessionId) {
      showToast('No code generation session to push', 'error');
      return;
    }
    try {
      const res = await fetchApi('/api/github/create-and-push', {
        method: 'POST',
        body: JSON.stringify({ sessionId, repoName: detail.repoName }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast((data as any).error ?? 'Push to GitHub failed', 'error');
        return;
      }
      showToast(`Pushed to GitHub as ${detail.repoName}`, 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Push to GitHub failed', 'error');
    }
  }

  function handleOpenInIde(e: CustomEvent<{ ide?: string }>) {
    const ide = e?.detail?.ide ?? 'cursor';
    showToast(`Opening in ${ide}...`, 'info');
    handleDownload();
  }

  function handleWorkflowReset() {
    resetWorkflow();
  }

  async function handleMermaidToCode(detail: {
    mermaidCode: string;
    framework: string;
    language: string;
    workspaceRoot?: string;
  }) {
    chatModeStore.setMode('code');
    if (detail.workspaceRoot) {
      workspaceStore.setWorkspace(detail.workspaceRoot);
      workspaceInput = detail.workspaceRoot;
    }
    inputText = `Generate ${detail.framework} code in ${detail.language} based on this architecture diagram:\n\n\`\`\`mermaid\n${detail.mermaidCode}\n\`\`\`\n\nCreate a complete project structure with all necessary files.`;
    await tick();
    sendMessage();
  }

  function loadSessionById(id: string) {
    const session = codeSessionsStore.load(id);
    if (session) {
      messages = JSON.parse(JSON.stringify(session.messages));
      workspaceInput = session.workspaceRoot ?? '';
      if (session.workspaceRoot) workspaceStore.setWorkspace(session.workspaceRoot);
      showToast(`Loaded: ${session.name}`, 'success');
      loadSessionModalOpen = false;
    }
  }

  function handleClearChat() {
    messages = [defaultMessage];
    inputText = '';
    showToast('Chat cleared', 'info');
  }
  function handleSaveSession() {
    const name = window.prompt('Session name', `Session ${new Date().toLocaleString()}`);
    if (name) {
      codeSessionsStore.save(name, messages, workspaceInput || null, 'general');
      showToast('Session saved', 'success');
    }
  }

  onMount(() => {
    inputRef?.focus();
    const w = get(workspaceStore);
    if (w) workspaceInput = w;
    document.addEventListener('keydown', handleGlobalKeydown);
    const handleOpenShipMode = () => {
      chatMode = 'ship';
    };
    window.addEventListener('open-ship-mode', handleOpenShipMode);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeydown);
      window.removeEventListener('open-ship-mode', handleOpenShipMode);
    };
  });
</script>

<div
  class="chat-interface"
  style:--bg-primary={colors.background.primary}
  style:--bg-secondary={colors.background.secondary}
>
  {#if showSettingsValue}
    <SettingsScreen onBack={() => showSettings.set(false)} />
  {:else}
    <div class="chat-root">
      <div class="chat-viewport">
        {#if chatMode === 'ship'}
          <div class="ship-mode-viewport">
            <ShipMode />
          </div>
        {:else}
          <div class="messages-scroll" bind:this={messagesRef}>
            <div class="messages-inner">
              {#if messages.length <= 1 && !streaming}
                <div class="empty-state">
                  <GRumpBlob size="lg" state="idle" animated={true} />
                  <h1 class="empty-title">What are we building?</h1>
                  <p class="empty-text">
                    I can design your system architecture, create requirements, and write the
                    full-stack code. Just tell me your idea.
                  </p>
                  <div class="suggestion-chips">
                    <SuggestionChips on:select={handleTemplateSelect} />
                  </div>
                </div>
              {/if}

              {#each messages as msg, index}
                <div class="message-wrapper {msg.role}">
                  <div class="message-avatar">
                    {#if msg.role === 'user'}
                      <div class="avatar-circle user">U</div>
                    {:else}
                      <div class="avatar-circle assistant">AI</div>
                    {/if}
                  </div>
                  <div class="message-content-container">
                    <div class="message-meta">
                      <span class="message-role">{msg.role === 'user' ? 'You' : 'G-Rump'}</span>
                      {#if msg.timestamp}<span class="message-time"
                          >{formatTimestamp(msg.timestamp)}</span
                        >{/if}
                    </div>
                    <div class="message-bubble">
                      {#if typeof msg.content === 'string'}
                        {#each parseMessageContent(msg.content) as block, bIdx}
                          {#if block.type === 'text'}
                            <div class="text-block">{block.content}</div>
                          {:else if block.type === 'mermaid'}
                            <div
                              class="diagram-card"
                              use:setupDiagramRef={{ index, blockIdx: bIdx }}
                            >
                              <div class="diagram-header">
                                <Badge variant="info">Architecture</Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onclick={() => exportSvg(index, bIdx)}>Export</Button
                                >
                              </div>
                              <DiagramRenderer
                                code={block.content}
                                on:generate-code={(e) =>
                                  handleMermaidToCode({
                                    mermaidCode: e.detail.mermaidCode,
                                    framework: 'react',
                                    language: 'typescript',
                                  })}
                              />
                            </div>
                          {/if}
                        {/each}
                      {:else}
                        {#each msg.content as block}
                          {#if block.type === 'text'}
                            <div class="text-block">{block.content}</div>
                          {:else if block.type === 'tool_call'}
                            <ToolCallCard toolCall={block} />
                          {:else if block.type === 'tool_result'}
                            <ToolResultCard toolResult={block} />
                          {/if}
                        {/each}
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}

              {#if streaming}
                <div class="message-wrapper assistant streaming">
                  <div class="message-avatar">
                    <div class="avatar-circle assistant">AI</div>
                  </div>
                  <div class="message-content-container">
                    <div class="message-meta">
                      <span class="message-role">G-Rump</span>
                      <span class="thinking-indicator">Thinking...</span>
                    </div>
                    <div class="message-bubble">
                      {#if streamingBlocks.length > 0}
                        {#each streamingBlocks as block}
                          {#if block.type === 'text'}
                            <div class="text-block">{block.content}</div>
                          {:else if block.type === 'tool_call'}
                            <ToolCallCard toolCall={block} />
                          {:else if block.type === 'tool_result'}
                            <ToolResultCard toolResult={block} />
                          {/if}
                        {/each}
                      {:else}
                        <div class="text-block">{streamingContent || '...'}</div>
                      {/if}
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {/if}

        <div class="chat-controls">
          <div class="controls-inner">
            {#if chatMode !== 'ship'}
              <form
                class="input-container"
                onsubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
              >
                <span class="input-prompt">&gt;</span>
                <div class="input-wrapper">
                  <input
                    bind:value={inputText}
                    bind:this={inputRef}
                    oninput={handleInputChange}
                    placeholder="Describe what you want to build..."
                    class="message-input"
                    disabled={streaming}
                  />
                </div>
                <button class="send-button" type="submit" disabled={!inputText.trim() || streaming}>
                  {#if streaming}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="lucide lucide-x"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg
                    >
                  {:else}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="lucide lucide-send"
                      ><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg
                    >
                  {/if}
                </button>
              </form>
            {/if}

            <!-- MODE SELECTOR RESTORED -->
            <div class="mode-selector">
              <button
                class="mode-btn {$chatModeStore === 'code' && chatMode === 'normal'
                  ? 'active'
                  : ''}"
                onclick={() => {
                  chatModeStore.setMode('code');
                  chatMode = 'normal';
                }}>Code</button
              >
              <button
                class="mode-btn {$chatModeStore === 'code' && chatMode === 'plan' ? 'active' : ''}"
                onclick={() => {
                  chatModeStore.setMode('code');
                  chatMode = 'plan';
                }}>Plan</button
              >
              <button
                class="mode-btn {$chatModeStore === 'code' && chatMode === 'spec' ? 'active' : ''}"
                onclick={() => {
                  chatModeStore.setMode('code');
                  chatMode = 'spec';
                }}>Spec</button
              >
              <button
                class="mode-btn {$chatModeStore === 'design' ? 'active' : ''}"
                onclick={() => chatModeStore.setMode('design')}>Design</button
              >
              <button
                class="mode-btn {$chatModeStore === 'argument' ? 'active' : ''}"
                onclick={() => chatModeStore.setMode('argument')}>Argument</button
              >
              <button
                class="mode-btn {chatMode === 'ship' ? 'active' : ''}"
                onclick={() => {
                  chatMode = 'ship';
                  window.dispatchEvent(new CustomEvent('open-ship-mode'));
                }}>Ship</button
              >
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .chat-interface {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background-color: var(--bg-primary);
    position: relative;
    font-family: 'Inter', sans-serif;
  }

  /* Chat Reset */
  .chat-interface :global(*) {
    box-sizing: border-box;
  }

  .chat-root {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .chat-viewport {
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }

  .ship-mode-viewport {
    flex: 1;
    overflow: auto;
    padding: 1rem;
    background-color: var(--bg-secondary);
  }

  .messages-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 2rem 1rem 8rem; /* Bottom padding for fixed controls */
    scroll-behavior: smooth;
  }

  .messages-inner {
    max-width: 800px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    text-align: center;
    gap: 1.5rem;
  }

  .empty-title {
    font-size: 2rem;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }

  .empty-text {
    font-size: 1.1rem;
    color: #6b7280;
    max-width: 500px;
    line-height: 1.6;
    margin: 0;
  }

  .suggestion-chips {
    margin-top: 1rem;
    display: flex;
    justify-content: center;
    width: 100%;
  }

  /* Message Bubbles */
  .message-wrapper {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    border-radius: 0.75rem;
    transition: background-color 0.2s;
  }

  .message-wrapper:hover {
    background-color: #f9fafb;
  }

  .message-wrapper.user {
    flex-direction: row-reverse;
  }

  .message-avatar {
    flex-shrink: 0;
    margin-top: 0.25rem;
  }

  .avatar-circle {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.875rem;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .avatar-circle.user {
    background-color: #3b82f6;
    color: white;
  }

  .avatar-circle.assistant {
    background-color: #10b981;
    color: white;
  }

  .message-content-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 85%;
  }

  .message-wrapper.user .message-content-container {
    align-items: flex-end;
  }

  .message-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: #9ca3af;
  }

  .message-role {
    font-weight: 600;
    color: #4b5563;
  }

  .thinking-indicator {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: #6366f1;
    font-weight: 500;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  /* Bubble Styling */
  .message-bubble {
    font-size: 1rem;
    line-height: 1.6;
    color: #1f2937;
    white-space: pre-wrap;
    word-break: break-word;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .message-wrapper.user .message-bubble {
    background-color: #3b82f6;
    color: white;
    padding: 0.75rem 1rem;
    border-radius: 1rem;
    border-top-right-radius: 0.25rem;
  }

  .message-wrapper.assistant .message-bubble {
    background-color: transparent;
    padding: 0;
  }

  .text-block {
    margin: 0;
  }

  /* Diagram Card */
  .diagram-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    overflow: hidden;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    margin: 0.5rem 0;
    display: flex;
    flex-direction: column;
  }

  .diagram-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #f3f4f6;
    background-color: #f9fafb;
  }

  /* Chat Controls (Fixed Bottom) */
  .chat-controls {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: white;
    padding: 1rem;
    border-top: 1px solid #e5e7eb;
    box-shadow: 0 -4px 6px -1px rgba(0, 0, 0, 0.05);
    z-index: 10;
  }

  .controls-inner {
    max-width: 800px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .input-container {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background-color: #f3f4f6;
    border-radius: 0.75rem;
    padding: 0.75rem 1rem;
    border: 1px solid transparent;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
  }

  .input-container:focus-within {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
    background-color: white;
  }

  .input-prompt {
    font-family: 'Fira Code', monospace;
    font-weight: 700;
    color: #6b7280;
    user-select: none;
  }

  .input-wrapper {
    flex: 1;
    display: flex;
  }

  .message-input {
    width: 100%;
    border: none;
    background: transparent;
    font-size: 1rem;
    color: #111827;
    outline: none;
    padding: 0;
  }

  .message-input::placeholder {
    color: #9ca3af;
  }

  .send-button {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.5rem;
    width: 2rem;
    height: 2rem;
    cursor: pointer;
    transition: background-color 0.2s;
    padding: 0;
  }

  .send-button:hover:not(:disabled) {
    background: #2563eb;
  }

  .send-button:disabled {
    background: #d1d5db;
    cursor: not-allowed;
  }

  /* Mode Selector */
  .mode-selector {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    padding-left: 2rem; /* Align with input text visually */
  }

  @media (max-width: 640px) {
    .mode-selector {
      padding-left: 0;
      justify-content: center;
    }

    .empty-title {
      font-size: 1.5rem;
    }

    .messages-scroll {
      padding-bottom: 10rem;
    }
  }
</style>
